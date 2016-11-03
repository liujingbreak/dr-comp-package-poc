var lang = __api.urlSearchParam().lang;
if (lang) {
	__api.loadLocaleBundles(lang, function() {
		require('./js');
	});
} else {
	__api.loadPrefLocaleBundles(function(language) {
		require('./js');
	});
}
