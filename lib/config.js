var logger = require('log4js').getLogger(__filename);
var _ = require('lodash');
var fs = require('fs');
var path = require('path');

var rootPath = path.resolve(__dirname, '..');
var setting;
var localConfigPath = rootPath + '/config.local.json';
load();

process.removeAllListeners('uncaughtException');
process.on('uncaughtException', function(err) {
	// handle the error safely
	logger.error('Uncaught exception: ', err, err.stack);
});
//TODO read local config
module.exports = function() {
	return setting;
};

module.exports.reload = function() {
	load();
	return setting;
};

function load() {
	logger.info('root path: ' + rootPath);
	setting = JSON.parse(fs.readFileSync(path.join(rootPath, 'config.json')));
	if (fs.existsSync(localConfigPath)) {
		_.extend(setting, JSON.parse(fs.readFileSync(path.join(rootPath, localConfigPath))));
	}
	return setting;
}
