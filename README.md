# glob-observable

[![npm version](https://img.shields.io/npm/v/glob-observable.svg)](https://www.npmjs.com/package/glob-observable)
[![Build Status](https://travis-ci.org/shinnn/glob-observable.svg?branch=master)](https://travis-ci.org/shinnn/glob-observable)
[![Build status](https://ci.appveyor.com/api/projects/status/yqir32l963x2k4iv/branch/master?svg=true)](https://ci.appveyor.com/project/ShinnosukeWatanabe/glob-observable/branch/master)
[![Coverage Status](https://img.shields.io/coveralls/shinnn/glob-observable.svg)](https://coveralls.io/github/shinnn/glob-observable?branch=master)

[Observable](https://github.com/tc39/proposal-observable)-based version of [node-glob](https://github.com/isaacs/node-glob):

> Match files using the patterns the shell uses, like stars and stuff.

```javascript
const globObservable = require('glob-observable');

globObservable('*.js').subscribe({
  next: ({path}) => console.log(path), // index.js, test.js, ...
  complete: () => console.log('Glob completed.')
});
```

## Installation

[Use]((https://docs.npmjs.com/cli/install)) [npm](https://docs.npmjs.com/getting-started/what-is-npm).

```
npm install glob-observable
```

## API

```javascript
const globObservable = require('glob-observable');
```

### globObservable(*pattern* [, *options*])

*pattern*: `string` (glob pattern)  
*options*: `Object` ([`glob` options](https://github.com/isaacs/node-glob#options) with `strict` and `silent` default to `true`)  
Return: [`Observable`](https://github.com/tc39/proposal-observable#observable) ([zenparsing's implementation](https://github.com/zenparsing/zen-observable))

#### Match result

Type: `Object`

When the observable is subscribed, it starts glob search and send a result object to the [observer](https://github.com/tc39/proposal-observable#observer) on every match. Unlike node-glob's [`match` event](https://github.com/isaacs/node-glob#events), all results are deduplicated if `nounique` option is disabled.

Each result object has the following properties:

##### cwd

Type: `string`

The current working directory where to search.

##### path

Type: `string`

The path of matched file or directory.

It'll be an absolute path if `absolute` option is enabled, otherwise relative to `cwd`. Also, it'll be resolved to a [realpath](http://man7.org/linux/man-pages/man3/realpath.3.html) if `realpath` option is enabled.

##### stat

Type: [`fs.Stats`](https://nodejs.org/api/fs.html#fs_class_fs_stats)

Information about the matched file or directory, for example mode and size. Only available if `stat` option is enabled.

```javascript
const globObservable = require('glob-observable');

const observable = globObservable('*.json', {stat: true});
const subscription = observable.subscribe(result => {
  result.cwd; //=> '/Users/me/projects/...'
  result.path; //=> 'package.json'
  result.stat; //=> { dev: 16666220, mode: 16877, ... }
  result.stat.isDirectory(); //=> false
});

// You can abort matching at any time.
subscription.unsubscribe();
```

## License

[ISC License](./LICENSE) © 2017 Shinnosuke Watanabe
