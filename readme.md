## Synopsis

Reload modules without restarting.

## Code Example

    const reaquire = require('reacquire')();
    reacquire('./tests/test.js');

or

    require('reacquire')({register: true});
    require('./tests/test.js');

## Motivation

While I was satisfied with nodemon for the most part, I encountered scenarios where a full reset of the program doesn't really work (such as iron-node).

This package watches imported modules and reruns them (and their dependencies), without restarting the node process.

## Installation

`npm i reacquire`

## API Reference

Two possible ways to declare reloadable modules:

1. Use `register: true` to hook `require` so that all imported modules are watched. Options are set on the initial import.

        const reacquire = import('reacquire')({register: true, [...options]})


2. Import the reacquire function to call on specific modules. Options can be set per module.

        const reacquire = import('reacquire')([options])
        reaquire(path, [options])

* `path` (string) path to a file, identical to node's `require`

### options

* `options` (object) Options object consisting of:
	* `watch` (default: `true`) whether to watch dependencies (otherwise a module will be reloaded with each `reacquire` call only).
	* `throttle` (default: `500`) Throttling wait time in milliseconds, to avoid unnecessary multiple reloads.
	* `watchModules` (default: `false`) Optionally watch `node_modules` for changes.

## Tests

`npm test`

## License

MIT
