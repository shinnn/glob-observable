'use strict';

const {resolve} = require('path');
const {Stats} = require('fs');

const aToZSort = require('alpha-sort').asc;
const globObservable = require('.');
const lnfs = require('lnfs');
const rmfr = require('rmfr');
const slash = require('slash');
const test = require('tape');
const unglobbable = require('unglobbable');

const dummyFileStat = new Stats(1000000, 33188, 1, 501, 20, 0, 4096, 500000, 1, 8);
const dummyFilePath = slash(resolve('__actually_this_file_does_not_exist__'));

test('globObservable()', async t => {
  t.plan(13);

  await rmfr('tmp');
  await Promise.all([
    lnfs('test.js', 'tmp/fixture-symlink'),
    lnfs('__none__', 'tmp/fixture-broken-symlink')
  ]);

  const unexpectedComplete = t.fail.bind(t, 'Glob unexpectedly succeeded.');

  globObservable('{*.js,index.js,tmp/fixture-symlink}')
  .reduce((results, current) => [...results, current], [])
  .subscribe({
    next(results) {
      t.deepEqual(
        results.map(({path}) => path),
        ['index.js', 'test.js', 'tmp/fixture-symlink'],
        'should match files using the glob pattern.'
      );

      t.deepEqual(
        results.map(({cwd}) => cwd),
        [process.cwd(), process.cwd(), process.cwd()],
        'should add `cwd` property to every result.'
      );

      t.deepEqual(
        results.map(result => 'stat' in result),
        [false, false, false],
        'should not add file stats to the results when `stat` option is disabled.'
      );
    },
    error: t.fail
  });

  globObservable('{tmp/*,*.js{,on},node_modules{,/eslint/**/config-file.js}}', {
    cwd: '.',
    root: '/!?/',
    ignore: ['index.js'],
    realpathCache: {
      [resolve('cache')]: '/1/2/3'
    },
    nounique: true,
    noglobstar: true,
    absolute: true,
    realpath: true,
    stat: true
  })
  .reduce((results, current) => [...results, current], [])
  .subscribe(results => {
    results.sort((prev, next) => aToZSort(slash(prev.path), slash(next.path)));

    t.deepEqual(
      results.map(({path}) => path),
      [
        'node_modules',
        'package.json',
        'test.js',
        'test.js',
        'tmp/fixture-broken-symlink'
      ].map(path => slash(resolve(path))),
      'should support node-glob options.'
    );

    t.ok(
      results[0].stat.isDirectory(),
      'should resolve directory stats when `stat` option is enabled.'
    );

    t.ok(
      results[1].stat.isFile(),
      'should resolve file stats when `stat` option is enabled.'
    );
  });

  globObservable(`{${'tmp/f*b*,'.repeat(100)}_}`, {realpath: true})
  .reduce((results, current) => [...results, current], [])
  .subscribe(([result]) => {
    t.deepEqual(
      result.path,
      slash(resolve('tmp/fixture-broken-symlink')),
      'should get an absolute path of broken symlink as a fallback.'
    );
  });

  let sum = 0;

  const subscription = globObservable('node_modules/**', {
    nounique: true,
    stat: true
  })
  .subscribe({
    next() {
      if (sum === 10) {
        subscription.unsubscribe();
        return;
      }

      sum += 1;
    },
    complete: unexpectedComplete
  });

  setTimeout(() => {
    t.strictEqual(sum, 10, 'should abort matching when `unsubscribe` method is called.');
  }, 300);

  globObservable(unglobbable)
  .subscribe({
    error({code}) {
      t.strictEqual(
        typeof code,
        'string',
        'should fail when node-glob emits an error.'
      );
    },
    complete: unexpectedComplete
  });

  globObservable(dummyFilePath, {
    statCache: {[dummyFilePath]: dummyFileStat},
    realpath: true
  })
  .subscribe({
    error({code}) {
      t.strictEqual(
        code,
        'ENOENT',
        'should fail when the `realpath` call results in an unexpected error.'
      );
    },
    complete: unexpectedComplete
  });

  globObservable(Buffer.from('hi'))
  .subscribe({
    error({message}) {
      t.strictEqual(
        message,
        'Expected a glob pattern string, but got <Buffer 68 69>.',
        'should fail when it takes a non-string glob pattern.'
      );
    },
    complete: unexpectedComplete
  });

  globObservable('*.yml', [1, 2])
  .subscribe({
    error({message}) {
      t.strictEqual(
        message,
        'Expected node-glob options to be an object, but got an array [ 1, 2 ].',
        'should fail when the second argument is not a plain object.'
      );
    },
    complete: unexpectedComplete
  });

  globObservable('{,,}', {sync: true})
  .subscribe({
    error({message}) {
      t.strictEqual(
        message,
        '`sync` option is deprecated and there’s no need to pass any values ' +
        'to that option, but true was provided.',
        'should fail when the depreacted option is used.'
      );
    },
    complete: unexpectedComplete
  });
});
