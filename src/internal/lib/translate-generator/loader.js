var tr = require('./translate-replacer');
var Path = require('path');
var api = require('__api');
var log = require('log4js').getLogger('api.packageName');
var yamljs = require('yamljs');
var fs = require('fs');
var pify = require('pify');
var readFileASync = pify(fs.readFile.bind(fs));

var cache = new Map();

module.exports = function(source) {
	var callback = this.async();
	var loader = this;
	var prom;
	try {
		var skipPackageCache = {};
		var file = this.resourcePath;
		var ext = Path.extname(file).toLowerCase();

		if (ext === '.js') {
			prom = tr.replaceJS(source, file, api.getBuildLocale(), skipPackageCache, onLoadRes);
		} else {
			prom = tr.replaceHtml(source, file, api.getBuildLocale(), skipPackageCache, onLoadRes);
		}
	} catch (err) {
		log.error(err);
		if (callback)
			return callback(err);
		throw err;
	}
	prom.then(replaced => callback(null, replaced))
	.catch(callback);

	function onLoadRes(name) {
		var cached = cache.get(name);
		if (cached)
			return Promise.resolve(cached);

		var file = require.resolve(name);
		loader.addDependency(file);
		return readFileASync(file, 'utf8')
		.then(content => {
			var json = yamljs.parse(content);
			cache.set(name, json);
			return json;
		});
	}
};

module.exports.clearCache = function() {
	cache.clear();
};

