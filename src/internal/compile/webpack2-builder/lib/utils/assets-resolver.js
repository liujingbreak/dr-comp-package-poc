var packagePathPat = /^(?:assets:\/\/|~)((?:@[^\/]+\/)?[^\/]+)?\/(.*)$/;
const npmimportCssLoader = require('require-injector/css-loader');
const api = require('__api');
//const log = require('log4js').getLogger('wfh.assets-resolver');

/**
 * A function to check and turn assets path like "~<package>/<path>", "assets://<package>/<path>",
 * "assets:///<path>" into unified format "assets://<package>/<path>", and call require-injector to
 * replace package name if needed
 */
exports.normalizeAssetsUrl = function(url, sourceFile) {
	var match = packagePathPat.exec(url);
	if (match) {
		var packageName = match[1];
		var relPath = match[2];
		if (!packageName || packageName === '') {
			var compPackage = api.findPackageByFile(sourceFile);
			packageName = compPackage.longName;
		}
		var injectedPackageName = npmimportCssLoader.getInjectedPackage(packageName, sourceFile, api.browserInjector);
		if (injectedPackageName)
			packageName = injectedPackageName;

		return `assets://${packageName}/${relPath}`;
	} else if (url.length > 1 && url.charAt(0) === '/' && url.charAt(1) !== '/') {
		var msg = `Problematic assets URL format ${url} in ${sourceFile}\n`;
		msg += `Valid path should be a "relative path" or in format as "assets://<package>/<path>" and "~<package>/<path>"`;
		throw new Error(msg);
	} else {
		return url;
	}
};
