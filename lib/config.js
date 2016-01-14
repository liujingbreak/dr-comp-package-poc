var log = require('log4js').getLogger(__filename);
var _ = require('lodash');
var fs = require('fs');
var path = require('path');

var rootPath = path.resolve(__dirname, '..');
var setting;
var localConfigPath = rootPath + '/config.local.json';
//TODO read local config
module.exports = function() {
	return setting;
};

module.exports.reload = function() {
	load();
	return setting;
};

function load() {
	log.info('root path: ' + rootPath);
	setting = JSON.parse(fs.readFileSync(path.join(rootPath, 'config.json')));
	if (fs.existsSync(localConfigPath)) {
		_.extend(setting, JSON.parse(fs.readFileSync(path.join(rootPath, localConfigPath))));
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
