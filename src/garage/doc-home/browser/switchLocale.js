var api = require('__api');

var lang = api.urlSearchParam().lang || api.getPrefLanguage();
if (!api.reloadToLocale(lang)) {
	if (__drcpEntryPage === 'index.html')
		require('./js');
}
