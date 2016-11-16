var lang = __api.urlSearchParam().lang;
if (lang) {
	__api.loadLocaleBundles(lang, start);
} else {
	__api.loadPrefLocaleBundles(start);
}

function start() {
	require('./js');
}
