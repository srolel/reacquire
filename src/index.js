import chokidar from 'chokidar';
import _throttle from 'lodash.throttle';
import assign from 'lodash.assign';
import Module from 'module';

// mostly for tests
const watchers = [];
const unwatch = () => {
    while (watchers.length) {
        watchers.pop().close();
    }
};

const factory = (_module, defaultOpts = {}) => {

    /**
     * Runs over the cache to search for all the cached
     * files. taken from http://stackoverflow.com/questions/9210542/node-js-require-cache-possible-to-invalidate/14801711#14801711
    */

    const searchCache = (moduleName, callback) => {
        // Resolve the module identified by the specified name
        var mod = _module.constructor._resolveFilename(moduleName, _module);

        // Check if the module has been resolved and found within
        // the cache
        if (mod && ((mod = _module.constructor._cache[mod]) !== undefined)) {
            // Recursively go over the results
            (function run(mod) {
                // Go over each of the module's children and
                // run over it
                mod.children.forEach(child => run(child));

                // Call the specified callback providing the
                // found module
                callback(mod);
            })(mod);
        }
    };

    /**
     * Removes a module from the cache
     */

    const uncache = moduleName => {
        // Run over the cache looking for the files
        // loaded by the specified module name
        searchCache(moduleName, (mod) =>
            delete _module.constructor._cache[mod.id]);

        // Remove cached paths to the module.
        Object.keys(_module.constructor._pathCache).forEach(cacheKey => {
            if (cacheKey.indexOf(moduleName) > 0) {
                delete _module.constructor._pathCache[cacheKey];
            }
        });
    };

    const getModules = moduleName => {
        let modules = [];
        searchCache(moduleName, mod => modules.push(mod.filename));
        return modules;
    }

    const getRelativeModules = (moduleName) => {
        const modules = getModules(moduleName);
        return modules.filter(mod => !mod.includes('node_modules'))
    };
    /* 
      * FACTORY RETURNS THIS FUNCTION 
    */
    return function(moduleName, opts = {}) {
        opts = assign({}, defaultOpts, opts);

        const {watch, throttle, watchModules, initialReload} = opts;

        const safeRequire = () => {
            try {
                _module.require(moduleName);
            } catch(e) {
                console.error(e.stack || e);
            }
        };

        if (!require.cache[moduleName]) {
            safeRequire();
        }

        // throttled function to clear cache and re-require module
        const reload = _throttle((mod) => {
                uncache(moduleName);
                return safeRequire();
            }, throttle, {trailing: false});

        if (watch) {
            // whether to watch node_modules
            const modules = watchModules 
                ? getModules(moduleName)
                : getRelativeModules(moduleName);

            watchers.push(chokidar.watch(modules)
                .on('change', reload));

        } else if (initialReload) {
            return reload();
        }
    };
}


const isAlreadyReloaded = (module, cache) => {
    while (module && module.parent) {
        if (cache[module.filename]) {
            return true;
        }
        module = module.parent;
    }
    return false;
}

const hookExtension = (cache, opts) => {
    const originalExtension = Module._extensions['.js'];
    Module._extensions['.js'] = (module, filename) => {
        originalExtension(module, filename);
        if (!isAlreadyReloaded(module, cache)) {
            // only hook once
            cache[filename] = true;
            factory(module.parent, opts)(filename);
        }
    }
};

const defaultOpts = {
    register: {watch: true, throttle: 500, watchModules: false, initialReload: false},
    noRegister: {watch: true, throttle: 500, watchModules: false, initialReload: true}
};

const validate = {
    options(arg) {
        return !arg || (typeof arg === 'object' && !Array.isArray(arg));
    }
};

const verifyInput = (options) => {
    if (validate.options(options) === false ) {
        const type = typeof options;
        let msg = 'Argument should be an object if provided, instead saw `' + type + '`.';
        if (type === 'string') {
            msg += ' Did you call the required module before trying to import? `var reacquire = require(\'reacquire\')()`';
        }
        throw new TypeError(msg);
    }
}

// _module should be the module that required the reacquire package.
module.exports = function(opts = {}) {

    verifyInput(opts);

    if (opts.register) {
        // hook native require
        const cache = {};
        opts = assign({}, defaultOpts.register, opts);
        hookExtension(cache, opts);
        return cache;  
    } else {
        // create a new require function and return it
        opts = assign({}, defaultOpts.noRegister, opts);
        // optional binding of module, because we depend on the hierarchy
        // and this module is imported and exported from {root}/index.js.
        // there's probably a better way to do this.
        const parentModule = (this && this.parent) || module.parent;
        return factory(parentModule, opts);
    }
}

module.exports.unwatch = unwatch;