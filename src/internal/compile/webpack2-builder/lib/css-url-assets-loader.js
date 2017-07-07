const api = require('__api');
const log = require('log4js').getLogger('wfh.' + __filename.substring(0, __filename.length - 3));
//const _ = require('lodash');
const npmimportCssLoader = require('require-injector/css-loader');

module.exports = function(content) {
	var callback = this.async();
	if (!callback)
		return load(content, this);
	loadAsync(content, this)
	.then(result => callback(null, result))
	.catch(err => callback(err));
};
module.exports.replaceAssetsUrl = replaceAssetsUrl;

function load(content, loader) {
	var file = loader.resourcePath;
	return replaceUrl.call(loader, content, file);
}

function loadAsync(content, loader) {
	try {
		return Promise.resolve(load(content, loader));
	} catch (e) {
		loader.emitError(e);
		return Promise.reject(e);
	}
}

var packagePathPat = /assets:\/\/((?:@[^\/]+\/)?[^\/]+)?(\/.*)/;

function replaceUrl(css, file) {
	return css.replace(/(\W)url\(\s*['"]?\s*([^'"\)]*)['"]?\s*\)/g,
		function(match, preChar, url) {
			var resolvedTo = preChar + 'url(' + replaceAssetsUrl(file, url) + ')';
			log.debug('url: %s  -> %s', url, resolvedTo);
			return resolvedTo;
		});
}

function replaceAssetsUrl(file, url) {
	var assetsUrlMatch = packagePathPat.exec(url);
	if (assetsUrlMatch) {
		var packageName = assetsUrlMatch[1];
		var path = assetsUrlMatch[2];
		if (!packageName || packageName === '')
			packageName = api.findPackageByFile(file).longName;
		try {
			var injectedPackageName = npmimportCssLoader.getInjectedPackage(packageName, file, api.browserInjector);
			if (injectedPackageName)
				return api.assetsUrl(injectedPackageName, path);
			if (injectedPackageName === '')
				log.error('%s has been replaced with `null` by require-injector, it should not be used as `assets://%s` anymore in file %s:', packageName, packageName, file);
			return api.assetsUrl(packageName, path);
		} catch (e) {
			log.error(e);
			return url;
		}
	}  else
		return url;
}

// function resolveUrl(packageName, path) {
// 	var assetsDirMap = api.config.get('outputPathMap.' + packageName);
// 	if (assetsDirMap != null)
// 		assetsDirMap = _.trim(api.config.get('outputPathMap.' + packageName), '/');
// 	else
// 		assetsDirMap = /(?:@([^\/]+)\/)?(\S+)/.exec(packageName)[2];
// 	if (_.startsWith(path, '/')) {
// 		path = path.substring(1);
// 	}
// 	assetsDirMap = _.trimStart(assetsDirMap, '/');
// 	return publicPath + _.trimStart((assetsDirMap + '/' + path).replace('//', '/'), '/');
// }
