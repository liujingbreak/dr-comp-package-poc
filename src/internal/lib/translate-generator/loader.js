var tr = require('./translate-replacer');
var Path = require('path');
var api = require('__api');
var log = require('log4js').getLogger('api.packageName');

module.exports = function(source) {
	var callback = this.async();
	var replaced;
	try {
		var skipPackageCache = {};
		var file = this.resourcePath;
		var ext = Path.extname(file).toLowerCase();
		if (ext === '.js') {
			replaced = tr.replaceJS(source, file, api.getBuildLocale(), skipPackageCache);
		} else if (ext === '.html') {
			replaced = tr.replaceHtml(source, file, api.getBuildLocale(), skipPackageCache);
		}
	} catch (err) {
		log.error(err);
		if (callback)
			return callback(err);
		throw err;
	}

	if (!callback) {
		return replaced;
	}
	callback(null, replaced);
};
