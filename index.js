/*!
 * glob-observable | MIT (c) Shinnosuke Watanabe
 * https://github.com/shinnn/glob-observable
*/
'use strict';

const inspect = require('util').inspect;

const assertValidGlobOpts = require('assert-valid-glob-opts');
const fsCacheableRealpath = require('fs.realpath/old.js').realpath;
const fsOriginalRealpath = require('graceful-fs').realpath;
const Glob = require('glob').Glob;
const makeAbs = require('glob/common.js').makeAbs;
const Observable = require('zen-observable');

module.exports = function globObservable(pattern, options) {
  return new Observable(observer => {
    if (typeof pattern !== 'string') {
      throw new TypeError(`Expected a glob pattern string, but got ${inspect(pattern)}.`);
    }

    assertValidGlobOpts(options);
    options = options || {};

    const realpath = options.realpath;
    const unique = options.nounique !== true;
    let realpathTasks = 0;
    let completed = false;
    const found = new Set();
    const realpathFound = new Set();

    const glob = new Glob(pattern, Object.assign({
      silent: true,
      strict: true
    }, options, {realpath: false}));

    const fsRealpath = options.realpathCache && Object.keys(options.realpathCache).length !== 0 ?
                     fsCacheableRealpath :
                     fsOriginalRealpath;

    const makeAbsOptions = {
      changedCwd: glob.changedCwd,
      cwd: glob.cwd,
      // glob.root affects the result of makeAbs
      // https://github.com/isaacs/node-glob/blob/v7.1.1/common.js#L206
      root: ''
    };

    function makeAbsIfNeeded(filePath) {
      if (options.absolute) {
        return filePath;
      }

      return makeAbs(makeAbsOptions, filePath);
    }

    function onMatch(match) {
      const result = {cwd: glob.cwd};

      if (realpath) {
        found.add(match);

        realpathTasks += 1;

        fsRealpath(match, glob.realpathCache, (err, resolvedRealpath) => {
          realpathTasks -= 1;

          if (err) {
            if (err.syscall !== 'stat') {
              observer.error(err);
              return;
            }

            resolvedRealpath = makeAbsIfNeeded(match);
          } else {
            resolvedRealpath = makeAbs(makeAbsOptions, resolvedRealpath);
          }

          if (unique) {
            if (realpathFound.has(resolvedRealpath)) {
              if (completed && realpathTasks === 0) {
                observer.complete();
              }

              return;
            }

            realpathFound.add(resolvedRealpath);
          }

          result.path = resolvedRealpath;

          if (options.stat) {
            result.stat = glob.statCache[resolvedRealpath];
          }

          observer.next(result);

          if (completed && realpathTasks === 0) {
            observer.complete();
          }
        });

        return;
      }

      if (unique) {
        if (found.has(match)) {
          return;
        }

        found.add(match);
      }

      result.path = match;

      if (options.stat) {
        result.stat = glob.statCache[makeAbsIfNeeded(match)];
      }

      observer.next(result);
    }

    glob.on('match', onMatch);

    glob.on('error', err => observer.error(err));

    glob.on('end', foundIncludingCached => {
      completed = true;

      for (const match of foundIncludingCached) {
        if (!found.has(match)) {
          onMatch(match);
        }
      }

      if (realpathTasks === 0) {
        observer.complete();
      }
    });

    return function abortGlob() {
      if (completed) {
        return;
      }

      // due to https://github.com/isaacs/node-glob/issues/279
      setTimeout(() => glob.abort(), 4);
    };
  });
};
