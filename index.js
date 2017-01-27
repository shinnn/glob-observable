/*!
 * glob-observable | MIT (c) Shinnosuke Watanabe
 * https://github.com/shinnn/glob-observable
*/
'use strict';

var inspect = require('util').inspect;

var assertValidGlobOpts = require('assert-valid-glob-opts');
var arrayDiffer = require('array-differ');
var fsCacheableRealpath = require('fs.realpath/old.js').realpath;
var fsOriginalRealpath = require('graceful-fs').realpath;
var Glob = require('glob').Glob;
var objectAssign = require('object-assign');
var Observable = require('zen-observable');

global.Promise = require('pinkie-promise');

module.exports = function globObservable(pattern, options) {
  return new Observable(function(observer) {
    if (typeof pattern !== 'string') {
      throw new TypeError('Expected a glob pattern string, but got ' + inspect(pattern) + '.');
    }

    assertValidGlobOpts(options);
    options = options || {};

    var realpath = options.realpath;
    var unique = options.nounique !== true;
    var realpathTasks = 0;
    var completed = false;
    var found = [];
    var realpathFound = [];

    var glob = new Glob(pattern, objectAssign({
      silent: true,
      strict: true
    }, options, {realpath: false}));

    var fsRealpath = options.realpathCache && Object.keys(options.realpathCache).length !== 0 ?
                     fsCacheableRealpath :
                     fsOriginalRealpath;

    function onMatch(match) {
      var result = {cwd: glob.cwd};

      if (realpath) {
        found.push(match);

        realpathTasks += 1;

        fsRealpath(match, glob.realpathCache, function(err, resolvedRealpath) {
          realpathTasks -= 1;

          if (err) {
            if (err.syscall !== 'stat') {
              observer.error(err);
              return;
            }

            resolvedRealpath = options.absolute ? match : glob._makeAbs(match);
          } else {
            resolvedRealpath = glob._makeAbs(resolvedRealpath);
          }

          if (unique) {
            if (realpathFound.indexOf(resolvedRealpath) !== -1) {
              if (completed && realpathTasks === 0) {
                observer.complete();
              }

              return;
            }

            realpathFound.push(resolvedRealpath);
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
        if (found.indexOf(match) !== -1) {
          return;
        }

        found.push(match);
      }

      result.path = match;

      if (options.stat) {
        result.stat = glob.statCache[options.absolute ? match : glob._makeAbs(match)];
      }

      observer.next(result);
    }

    glob.on('match', onMatch);

    glob.on('error', function(err) {
      observer.error(err);
    });

    glob.on('end', function(foundIncludingCached) {
      completed = true;

      var cachedMatches = arrayDiffer(foundIncludingCached, found);
      cachedMatches.forEach(onMatch);

      if (realpathTasks === 0) {
        observer.complete();
      }
    });

    return function abortGlob() {
      if (completed) {
        return;
      }

      // due to https://github.com/isaacs/node-glob/issues/279
      setTimeout(function() {
        glob.abort();
      }, 4);
    };
  });
};
