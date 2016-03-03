var markdownViewer = require('@dr/markdown-viewer');
var Path = require('path');
var fs = require('fs');
var _ = require('lodash');
var log = require('@dr/logger').getLogger('doc-home');

var packageReadmeCache = {};

module.exports.activate = function(api) {
	api.router().get('/', function(req, res) {
		res.redirect(api.assetsUrl('/index.html'));
	});

	api.router().get('/server/readmes/:name', function(req, res) {
		var name = req.params.name;
		var cache = packageReadmeCache[name];
		if (!cache) {
			res.send('Readme not found, available readmes: ' +
				_.keys(packageReadmeCache).join('<br/>'));
			return;
		}
		var html = markdownViewer(cache.path);
		res.send(html);
	});

	api.packageUtils.findAllPackages(function(name, entryPath, parsedName, json, packagePath) {
		var path = Path.join(packagePath, 'README.md');
		if (fs.existsSync(path)) {
			log.debug('README.md found ' + path);
			packageReadmeCache[parsedName.name] = {
				path: path
			};
		}
	});
};
