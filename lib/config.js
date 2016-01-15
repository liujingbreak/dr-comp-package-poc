var log = require('log4js').getLogger('lib.config');
var _ = require('lodash');
var fs = require('fs');
var path = require('path');

var rootPath = path.resolve(__dirname, '..');
var setting;
var localConfigPath = path.join(rootPath, '/config.local.json');
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

require('log4js').configure('./log4js.json');

function load() {
	log.debug('root path: ' + rootPath);
	setting = setting || {};
	_.extend(setting,
		{
			rootPath: rootPath
		},
		JSON.parse(
			fs.readFileSync(path.join(rootPath, 'config.json'))));

	if (fs.existsSync(localConfigPath)) {
		_.extend(setting, JSON.parse(fs.readFileSync(localConfigPath)));
	}

	setting.port = normalizePort(setting.port);
	return setting;
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
