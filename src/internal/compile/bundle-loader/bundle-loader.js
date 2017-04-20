/* globals __EXTERNAL_JS, drApi: true, $LAB */
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

/**
 * @param callback function(error) optional
 */
exports.runJsBundles = function(jsPaths, urlPrefix, entryPackageName, entryApiData, isDebug, callback) {
	var debug = !!isDebug;

	if (typeof (__EXTERNAL_JS) !== 'undefined')
		jsPaths.push.apply(jsPaths, __EXTERNAL_JS);
	var bundles = [];
	for (var i = 0, l = jsPaths.length; i < l; i++) {
		var jsPath = jsPaths[i];
		bundles.push(resolveBundleUrl(jsPath, urlPrefix));
	}
	$LAB
	.setGlobalDefaults({Debug: debug, AlwaysPreserveOrder: true})
	.script(bundles).wait(function() {
		try {
			if (typeof drApi !== 'undefined')
				return;
			drApi = require('@dr-core/browserify-builder-api');
			drApi.setup(entryApiData);
			drApi.setup({loadedBundles: bundles});
			require(entryPackageName);
			if (callback)
				callback(null);
		} catch (e) {
			if (console) console.error(e.stack);
			if (callback)
				callback(e);
		}
	});
};

/**
 * Helps to preload font file, must be invoke after CSS file which defines @font-face be loaded
 * (Read https://github.com/bramstein/fontfaceobserver)
 * @param fonts Array<Font | fontFamilyName> | Font | fontFamilyName: string
 * interface FontOption {
 * 		name: string, // fontFamilyName
 * 		weight?: number | string,
 * 		style?: string,
 * 		stretch?: any
 * 		...
 * }
 */
exports.reploadJs = function(fontfaceobserverBundle, urlPrefix, isDebug, callback) {
	$LAB
	.setGlobalDefaults({Debug: !!isDebug, AlwaysPreserveOrder: true})
	.script(resolveBundleUrl(fontfaceobserverBundle, urlPrefix)).wait(callback);
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
