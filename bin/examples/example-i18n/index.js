/**
 * Demo how angularJS's i18n file works in this platform
 * If you want to decide which language you prefer to render by yourown, replace with
 * 		__api.loadLocaleBundles(language, function callback() { ... });
 */
__api.loadPrefLocaleBundles(function(browserLanguage) {
	//if you want to support localization, put all your logic in this block
	require('./module.js');
});
