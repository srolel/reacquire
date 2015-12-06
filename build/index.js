'use strict';

var _typeof2 = require('babel-runtime/helpers/typeof');

var _typeof3 = _interopRequireDefault(_typeof2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _chokidar = require('chokidar');

var _chokidar2 = _interopRequireDefault(_chokidar);

var _lodash = require('lodash.throttle');

var _lodash2 = _interopRequireDefault(_lodash);

var _lodash3 = require('lodash.assign');

var _lodash4 = _interopRequireDefault(_lodash3);

var _module = require('module');

var _module2 = _interopRequireDefault(_module);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// mostly for tests
var watchers = [];
var unwatch = function unwatch() {
    while (watchers.length) {
        watchers.pop().close();
    }
};

var factory = function factory(module) {
    var defaultOpts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    /**
     * Runs over the cache to search for all the cached
     * files. taken from http://stackoverflow.com/questions/9210542/node-js-require-cache-possible-to-invalidate/14801711#14801711
    */

    var searchCache = function searchCache(moduleName, callback) {
        // Resolve the module identified by the specified name
        var mod = module.constructor._resolveFilename(moduleName, module);

        // Check if the module has been resolved and found within
        // the cache
        if (mod && (mod = module.constructor._cache[mod]) !== undefined) {
            // Recursively go over the results
            (function run(mod) {
                // Go over each of the module's children and
                // run over it
                mod.children.forEach(function (child) {
                    return run(child);
                });

                // Call the specified callback providing the
                // found module
                callback(mod);
            })(mod);
        }
    };

    /**
     * Removes a module from the cache
     */

    var uncache = function uncache(moduleName) {
        // Run over the cache looking for the files
        // loaded by the specified module name
        searchCache(moduleName, function (mod) {
            return delete module.constructor._cache[mod.id];
        });

        // Remove cached paths to the module.
        (0, _keys2.default)(module.constructor._pathCache).forEach(function (cacheKey) {
            if (cacheKey.indexOf(moduleName) > 0) {
                delete module.constructor._pathCache[cacheKey];
            }
        });
    };

    var getModules = function getModules(moduleName) {
        var modules = [];
        searchCache(moduleName, function (mod) {
            return modules.push(mod.filename);
        });
        return modules;
    };

    var getRelativeModules = function getRelativeModules(moduleName) {
        var modules = getModules(moduleName);
        return modules.filter(function (mod) {
            return !mod.includes('node_modules');
        });
    };
    /* 
      * FACTORY RETURNS THIS FUNCTION 
    */
    return function (moduleName) {
        var opts = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

        opts = (0, _lodash4.default)({}, defaultOpts, opts);

        var _opts = opts;
        var watch = _opts.watch;
        var throttle = _opts.throttle;
        var watchModules = _opts.watchModules;
        var initialReload = _opts.initialReload;

        var safeRequire = function safeRequire() {
            try {
                module.require(moduleName);
            } catch (e) {
                console.error(e.stack || e);
            }
        };

        if (!require.cache[moduleName]) {
            safeRequire();
        }

        // throttled function to clear cache and re-require module
        var reload = (0, _lodash2.default)(function (mod) {
            uncache(moduleName);
            return safeRequire();
        }, throttle, { trailing: false });

        if (watch) {
            // whether to watch node_modules
            var modules = watchModules ? getModules(moduleName) : getRelativeModules(moduleName);

            watchers.push(_chokidar2.default.watch(modules).on('change', reload));
        } else if (initialReload) {
            return reload();
        }
    };
};

var isAlreadyReloaded = function isAlreadyReloaded(module, cache) {
    while (module && module.parent) {
        if (cache[module.filename]) {
            return true;
        }
        module = module.parent;
    }
    return false;
};

var hookExtension = function hookExtension(cache, opts) {
    var originalExtension = _module2.default._extensions['.js'];
    _module2.default._extensions['.js'] = function (module, filename) {
        originalExtension(module, filename);
        if (!isAlreadyReloaded(module, cache)) {
            // only hook once
            cache[filename] = true;
            factory(module.parent, opts)(filename);
        }
    };
};

var defaultOpts = {
    register: { watch: true, throttle: 500, watchModules: false, initialReload: false },
    noRegister: { watch: true, throttle: 500, watchModules: false, initialReload: true }
};

var validate = {
    options: function options(arg) {
        return !arg || (typeof arg === 'undefined' ? 'undefined' : (0, _typeof3.default)(arg)) === 'object' && !Array.isArray(arg);
    }
};

var verifyInput = function verifyInput(options) {
    if (validate.options(options) === false) {
        var type = typeof options === 'undefined' ? 'undefined' : (0, _typeof3.default)(options);
        var msg = 'Argument should be an object if provided, instead saw `' + type + '`.';
        if (type === 'string') {
            msg += ' Did you call the required module before trying to import? `var reacquire = require(\'reacquire\')()`';
        }
        throw new TypeError(msg);
    }
};

module.exports = function () {
    var opts = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    verifyInput(opts);

    if (opts.register) {
        // hook native require
        var cache = {};
        opts = (0, _lodash4.default)({}, defaultOpts.register, opts);
        hookExtension(cache, opts);
        return cache;
    } else {
        // create a new require function and return it
        opts = (0, _lodash4.default)({}, defaultOpts.noRegister, opts);
        return factory(module.parent, opts);
    }
};

module.exports.unwatch = unwatch;