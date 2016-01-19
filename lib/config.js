var log = require('log4js').getLogger('lib.config');
var _ = require('lodash');
var fs = require('fs');
var Path = require('path');

var rootPath = Path.resolve(__dirname, '..');
var setting;
var localConfigPath = Path.join(rootPath, 'config.local.json');
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
	_.extend(setting,
		{
			rootPath: rootPath
		},
		JSON.parse(
			fs.readFileSync(Path.join(rootPath, 'config.json'))));

	if (fs.existsSync(localConfigPath)) {
		_.extend(setting, JSON.parse(fs.readFileSync(localConfigPath)));
	}

	validateConfig();
	setting.port = normalizePort(setting.port);
	return setting;
}

function validateConfig() {
	if (!setting.nodeRoutePath) {
		log.error('"nodeRoutePath" must be set in config.json');
		throw new Error('Invalid configuration');
	}
	setting.nodeRoutePath = _.endsWith(setting.nodeRoutePath, '/') ?
		setting.nodeRoutePath.substring(0, setting.nodeRoutePath.length - 1) :
		setting.nodeRoutePath;
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
