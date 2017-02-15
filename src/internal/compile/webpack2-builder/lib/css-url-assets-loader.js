const api = require('__api');
const log = require('log4js').getLogger(api.packageName + __filename.substring(0, __filename.length - 3));
const _ = require('lodash');
const npmimportCssLoader = require('./npmimport-css-loader');

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
		return Promise.reject(e);
	}
}

var packagePathPat = /assets:\/\/((?:@[^\/]+\/)?[^\/]+)?(\/.*)/;
var resolveStaticUrl = require('@dr-core/browserify-builder-api').resolveUrl;

function replaceUrl(css, file) {
	var loader = this;
	return css.replace(/(\W)url\(\s*['"]?\s*([^'"\)]*)['"]?\s*\)/g,
		function(match, preChar, url) {
			var resolvedTo = preChar + 'url(' + replaceAssetsUrl(loader.options.output.publicPath, file, url) + ')';
			log.debug('url: %s  -> %s', url, resolvedTo);
			return resolvedTo;
		});
}

function replaceAssetsUrl(publicPath, file, url) {
	var assetsUrlMatch = packagePathPat.exec(url);
	if (assetsUrlMatch) {
		var packageName = assetsUrlMatch[1];
		var path = assetsUrlMatch[2];
		if (!packageName || packageName === '')
			packageName = api.findPackageByFile(file).longName;
		try {
			var injectedPackageName = npmimportCssLoader.getInjectedPackage(packageName, file);
			if (injectedPackageName)
				return resolveBlobCssUrl.call(this, publicPath, api.config, injectedPackageName, path);
			if (injectedPackageName === '')
				log.error('%s has been replaced with `null` by require-injector, it should not be used as `assets://%s` anymore in file %s:', packageName, packageName, file);
			return resolveBlobCssUrl.call(this, publicPath, api.config, packageName, path);
		} catch (e) {
			log.error(e);
			return url;
		}
	}  else
		return url;
}

function resolveBlobCssUrl(publicPath) {
	var url = resolveStaticUrl.apply(this, [].slice.call(arguments, 1));
	if (!/^https?:\/\//.test(url))
		return publicPath + _.trimStart(url, '/');
	else
		return url;
}
