var tr = require('./translate-replacer');
var Path = require('path');
var api = require('__api');

module.exports = function(source) {
	var replaced;
	var skipPackageCache = {};
	var file = this.resourcePath;
	var ext = Path.extname(file).toLowerCase();
	if (ext === '.js') {
		replaced = tr.replaceJS(source, file, api.getBuildLocale(), skipPackageCache);
	} else if (ext === '.html') {
		replaced = tr.replaceHtml(source, file, api.getBuildLocale(), skipPackageCache);
	}
	var callback = this.async();
	if (!callback) {
		return replaced;
	}
	callback(null, replaced);
};
