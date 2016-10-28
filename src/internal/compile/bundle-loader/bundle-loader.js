/* globals __EXTERNAL_JS, drApi: true */
exports.loadCssBundles = function(paths, urlPrefix) {
	var h = window.document.getElementsByTagName('head')[0];
	for (var i = 0, l = paths.length; i < l; i++) {
		var bundle = paths[i];
		var cssDom = document.createElement('link');
		cssDom.rel = 'stylesheet';
		cssDom.href = resolveBundleUrl(bundle, urlPrefix);
		cssDom.type = 'text/css';
		cssDom.id = bundle;
		h.appendChild(cssDom);
	}
};

exports.runJsBundles = function(jsPaths, urlPrefix, entryPackageName, entryApiData, isDebug) {
	var debug = !!isDebug;

	if (typeof (__EXTERNAL_JS) !== 'undefined')
		jsPaths.push.apply(jsPaths, __EXTERNAL_JS);
	var bundles = [];
	for (var i = 0, l = jsPaths.length; i < l; i++) {
		var jsPath = jsPaths[i];
		bundles.push(resolveBundleUrl(jsPath, urlPrefix));
	}
	window.$LAB
	.setGlobalDefaults({Debug: debug})
	.script(bundles).wait(function() {
		try {
			drApi = require('@dr-core/browserify-builder-api');
			drApi.setup(entryApiData);
			drApi.setup({loadedBundles: bundles});
			require(entryPackageName);
		} catch (e) {
			if (console) console.error(e.stack);
		}
	});
};

exports.resolveBundleUrl = resolveBundleUrl;
function resolveBundleUrl(bundlePath, urlPrefix) {
	if (!urlPrefix)
		urlPrefix = '';
	if (bundlePath.charAt(0) === '/' || (bundlePath.length >= 7 &&
			(bundlePath.substring(0, 7) === 'http://' || bundlePath.substring(0, 8) === 'https://')))
		return bundlePath;
	else
		return (urlPrefix ? urlPrefix : '') + '/' + bundlePath;
}
