const api = require('__api');
//const log = require('log4js').getLogger('wfh.' + __filename.substring(0, __filename.length - 3));
const _ = require('lodash');
//const pify = require('pify');
const Path = require('path');
const vm = require('vm');

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
	return evaluate(content, loader.resourcePath)
	.then(result => {
		var browserPackage = api.findPackageByFile(loader.resourcePath);
		if (browserPackage) {
			var packageExports = require(browserPackage.longName);
			if (packageExports && _.isFunction(packageExports.onCompileTemplate)) {
				loader.addDependency(require.resolve(browserPackage.longName));
				return Promise.resolve(packageExports.onCompileTemplate(
					Path.relative(browserPackage.realPackagePath, loader.resourcePath).replace(/\\/g, '/'),
					null))
				.then(data => {
					return result(data.locals);
				});
			}
		}
		return result();
	});
}

function evaluate(source, filename) {
	var m = {exports: {}};
	var vmContext = vm.createContext(_.assign({require: require, module: m}, global));
	var vmScript = new vm.Script(source, {filename: filename});
	// Evaluate code and cast to string
	var newSource;
	try {
		newSource = vmScript.runInContext(vmContext);
	} catch (e) {
		return Promise.reject(e);
	}
	if (typeof newSource === 'object' && newSource.__esModule && newSource.default) {
		newSource = newSource.default;
	}
	return typeof newSource === 'string' || typeof newSource === 'function' ? Promise.resolve(newSource)
		: Promise.reject('The loader for "' + filename + '" didn\'t return html.');
}
