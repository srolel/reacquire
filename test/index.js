import fsp from 'fs-promise';
import fs from 'fs';
import assert from 'assert';
import Module from 'module';
import {unwatch} from '../src/index';

const delay = ms => new Promise((resolve) => setTimeout(resolve, ms));

const loop = async (fn, times, ms) => {
	for (let i = 0; i < times; i++) {
		await fn();
		await delay(ms);
	}
};

const src = fs.readFileSync('./test/module.js');
const oldExtensions = Module._extensions['.js'];
describe('reacquire', () => {

	beforeEach(() => {
		global.__numLoaded = 0;
	});

	afterEach(() => {
		Module._extensions['.js'] = oldExtensions;
		delete require.cache[require.resolve('./module.js')];
		unwatch();
	});

	it('should be loaded twice with register', async () => {
		require('../src/index.js')({register: true, throttle: 200});
		require('./module.js');
		await delay(100);
		await fsp.writeFile('./test/module.js', src);
		assert.equal(global.__numLoaded, 2);
	});

	it('should be loaded around five times with throttle of 100ms over 500ms', async () => {
		require('../src/index.js')({register: true, throttle: 100});
		require('./module.js');
		await loop(() => fsp.writeFile('./test/module.js', src), 5, 100);
		assert(global.__numLoaded >= 4 && global.__numLoaded <= 6, 'expected a number between 4 and 6, saw ' + global.__numLoaded);
	});

	it('should not be reloaded from ordinary requires', async () => {
		require('../src/index.js')({register: true, throttle: 100});
		await loop(() => require('./module.js'), 3, 100);
		assert.equal(global.__numLoaded, 1);
	});

	it('should be loaded twice without register', async () => {
		const reacquire = require('../src/index.js')({throttle: 200});
		reacquire('./module.js');
		await delay(100);
		await fsp.writeFile('./test/module.js', src);
		assert.equal(global.__numLoaded, 2);
	});

	it('should be loaded five times without register with throttle of 100ms over 500ms', async () => {
		const reacquire = require('../src/index.js')({throttle: 100});
		reacquire('./module.js');
		await loop(() => fsp.writeFile('./test/module.js', src), 5, 100);
	});

	it('should not be reloaded from ordinary requires', async () => {
		const reacquire = require('../src/index.js')({throttle: 100});
		await loop(() => require('./module.js'), 3, 100);
		assert.equal(global.__numLoaded, 1);
	});

})

