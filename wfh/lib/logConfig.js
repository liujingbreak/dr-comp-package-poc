var mkdirp = require('mkdirp');
var Path = require('path');
var fs = require('fs');

module.exports = function(rootPath, reloadSec) {
	var log4jsConfig = Path.join(rootPath, 'log4js.json');
	if (!fs.existsSync(log4jsConfig)) {
		console.log('Logging configuration is not found %s', log4jsConfig);
		return;
	}
	mkdirp.sync(Path.resolve(rootPath, 'logs'));

	var opt = {
		cwd: rootPath
	};

	if (reloadSec !== undefined)
		opt.reloadSecs = reloadSec;
	require('log4js').configure(log4jsConfig, opt);
};
