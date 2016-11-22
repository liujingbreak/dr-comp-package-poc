var api = require('__api');
var lang = api.urlSearchParam().lang || api.getPrefLanguage();
if (!api.reloadToLocale(lang))
	require('./js');
