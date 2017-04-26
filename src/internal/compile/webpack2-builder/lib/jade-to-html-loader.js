const api = require('__api');
//const log = require('log4js').getLogger('wfh.' + __filename.substring(0, __filename.length - 3));
const _ = require('lodash');
//const pify = require('pify');
const Path = require('path');
const jade = require('jade');
// const vm = require('vm');

module.exports = function(content) {
	var callback = this.async();
	if (!callback) {
		this.emitError('Only support async mode');
		throw new Error('Only support async mode');
	}
	loadAsync(content, this)
	.then(result => callback(null, result))
	.catch(err => callback(err));
};

function loadAsync(content, loader) {
	var prom;
	var browserPackage = api.findPackageByFile(loader.resourcePath);
	if (browserPackage) {
		var packageExports = require(browserPackage.longName);
		if (packageExports && _.isFunction(packageExports.onCompileTemplate)) {
			loader.addDependency(require.resolve(browserPackage.longName));
			prom = Promise.resolve(packageExports.onCompileTemplate(
				Path.relative(browserPackage.realPackagePath, loader.resourcePath).replace(/\\/g, '/'),
				null))
			.then(data => data.locals ? data.locals : data);
		} else
			prom = Promise.resolve({});
		return prom.then(locals => {
			return jade.render(content, Object.assign(locals, {
				filename: loader.resourcePath,
				compileDebug: api.config().devMode,
				basedir: browserPackage.realPackagePath
			}));
		});
	} else
		return Promise.resolve(content);
}

// function evaluate(source, filename) {
// 	var m = {exports: {}};
// 	var vmContext = vm.createContext(_.assign({require: require, module: m}, global));
// 	var vmScript = new vm.Script(source, {filename: filename});
// 	// Evaluate code and cast to string
// 	var newSource;
// 	try {
// 		newSource = vmScript.runInContext(vmContext);
// 	} catch (e) {
// 		return Promise.reject(e);
// 	}
// 	if (typeof newSource === 'object' && newSource.__esModule && newSource.default) {
// 		newSource = newSource.default;
// 	}
// 	return typeof newSource === 'string' || typeof newSource === 'function' ? Promise.resolve(newSource)
// 		: Promise.reject('The loader for "' + filename + '" didn\'t return html.');
// }
