var log = require('log4js').getLogger('lib.config');
var _ = require('lodash');
var fs = require('fs');
var Path = require('path');
var yamljs = require('yamljs');

var rootPath = Path.resolve(__dirname, '..');
var setting;
var localConfigPath = Path.join(rootPath, 'config.local.yaml');
//TODO read local config

module.exports = function() {
	if (!setting) {
		load();
	}
	return setting;
};

module.exports.reload = function() {
	load();
	return setting;
};

module.exports.set = function(name, value) {
	setting[name] = value;
	return setting;
};

require('log4js').configure(Path.join(rootPath, 'log4js.json'));

function load() {
	log.debug('root Path: ' + rootPath);

	setting = setting || {};
	_.assign(setting,
		{
			rootPath: rootPath
		},
		yamljs.parse(
			fs.readFileSync(Path.join(rootPath, 'config.yaml'), 'utf8')));

	if (fs.existsSync(localConfigPath)) {
		_.assign(setting, yamljs.parse(fs.readFileSync(localConfigPath, 'utf8')));
	}
	if (setting.devMode) {
		log.info('Developer mode');
	} else {
		log.info('Production mode');
	}
	validateConfig();
	setting.port = normalizePort(setting.port);
	return setting;
}

function validateConfig() {
	if (!setting.nodeRoutePath) {
		log.error('"nodeRoutePath" must be set in config.yaml');
		throw new Error('Invalid configuration');
	}

	['staticAssetsURL',
	'nodeRoutePath',
	'compiledDir'].forEach(function(prop) {
		setting[prop] = trimTailSlash(setting[prop]);
	});

	var contextMapping = setting.packageContextPathMapping;
	if (contextMapping) {
		_.forOwn(contextMapping, function(path, key) {
			contextMapping[key] = trimTailSlash(path);
		});
	}
}

function trimTailSlash(url) {
	if (url === '/') {
		return url;
	}
	return _.endsWith(url, '/') ? url.substring(0, url.length - 1) : url;
}

function normalizePort(val) {
	var port = parseInt(val, 10);

	if (isNaN(port)) {
		// named pipe
		return val;
	}

	if (port >= 0) {
		// port number
		return port;
	}

	return false;
}
