const api = require('__api');
const log = require('log4js').getLogger(api.packageName + '.npmimport-css-loader');
const _ = require('lodash');

/**
 * Some legacy LESS files reply on npm-import-plugin, which are using convention like
 * "import 'npm://bootstrap/less/bootstrap';" to locate LESS file from node_modules,
 * but with Webpack resolver, it changes to use `@import "~bootstrap/less/bootstrap";`.
 *
 * This loader replaces all "import ... npm://"s with webpack's "import ... ~" style,
 * and works with require-injector to replace package.
 */
module.exports = function(content) {
	var callback = this.async();
	if (!callback)
		throw new Error('Must be used as async loader');
	loadAsync(content, this)
	.then(result => callback(null, result))
	.catch(err => {
		this.emitError(err);
		callback(err);
	});
};

function loadAsync(content, loader) {
	var file = loader.resourcePath;
	content = injectReplace(content, file, loader);
	return Promise.resolve(content);
}

function injectReplace(content, file, loader) {
	var replaced = content.replace(/@import\s+(?:\([^\)]*\)\s+)?["'](?:npm:\/\/|~(?!\/))((?:@[^\/]+\/)?[^\/]+)(\/.+?)?["'];?/g, (match, packageName, relPath, offset, whole) => {
		if (relPath == null)
			relPath = '';
		var packageResourcePath = packageName + relPath;
		var newPackage = getInjectedPackage(file, packageResourcePath);
		if (newPackage) {
			log.info(`Found injected less import target: ${packageResourcePath}, replaced to ${newPackage}`);
			packageResourcePath = newPackage;
			return '@import "~' + packageResourcePath + '";';
		} else if (newPackage === '') {// delete whole line, do not import anything
			log.debug(`Remove import `);
			return `/* Deleted by npmimport-css-loader ${match}*/`;
		}
		return '@import "~' + packageResourcePath + '";';
	});
	return replaced;
}

module.exports.getInjectedPackage = getInjectedPackage;

/**
 *
 * @param {*} file
 * @param {*} origPackageName
 * @return {*} could be {string} for injected package name, {null} for no injection, empty string for `replaceCode` with falsy value
 */
function getInjectedPackage(file, origPackageName) {
	var fmaps = api.browserInjector.factoryMapsForFile(file);
	var replaced = null;
	if (fmaps.length > 0) {
		_.some(fmaps, factoryMap => {
			var ijSetting = factoryMap.matchRequire(origPackageName);
			if (!ijSetting)
				return false;
			if (ijSetting.method === 'substitute') {
				replaced = _.isFunction(ijSetting.value) ? ijSetting.value(file, ijSetting.execResult) : ijSetting.value;
				return true;
			} else if (ijSetting.method === 'replaceCode') {
				replaced = _.isFunction(ijSetting.value) ? ijSetting.value(file, ijSetting.execResult) : ijSetting.value;
				if (!replaced)
					replaced = '';
				else
					replaced = null;
				return true;
			}
			return false;
		});
	}
	return replaced;
}
