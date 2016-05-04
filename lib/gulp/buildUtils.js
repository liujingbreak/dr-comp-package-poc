var fs = require('fs');
var Path = require('path');
var config = require('../config');
var mkdirp = require('mkdirp');
var Promise = require('bluebird');

var isWindows = process.platform === 'win32';
// var log = require('log4js').getLogger(Path.basename(__filename));

exports.readTimestamp = readTimestamp;
exports.writeTimestamp = writeTimestamp;

var timeStampCache = null;
var file = Path.join(config.resolve('destDir'), 'timestamp.txt');

/**
 * @param  {string} name [description]
 * @return {number}      returns null if there is no timestamp file
 */
function readTimestamp(name) {
	if (timeStampCache) {
		return timeStampCache[name];
	}
	if (!fs.existsSync(file)) {
		return null;
	}
	var txt = fs.readFileSync(file, 'utf8');
	timeStampCache = JSON.parse(txt);
	return timeStampCache ? timeStampCache[name] : null;
}

function writeTimestamp(name) {
	var time = new Date().getTime();
	if (!timeStampCache) {
		if (!fs.existsSync(file)) {
			timeStampCache = {};
		} else {
			var txt = fs.readFileSync(file, 'utf8');
			timeStampCache = JSON.parse(txt);
		}
	}
	timeStampCache[name] = time;
	mkdirp.sync(Path.dirname(file));
	fs.writeFileSync(file, JSON.stringify(timeStampCache, null, '\t'));
}

exports.promisifySpawn = function(command, args) {
	var spawn = require('child_process').spawn;

	var res = spawn(command, args);
	return new Promise(function(resolve, reject) {
		res.on('exit', function(code, signal) {
			if (code !== 0 ) {
				return reject(signal);
			}
			resolve();
		});
		res.on('error', reject);
		res.stderr.pipe(process.stderr);
		res.stdout.pipe(process.stdout);
	});
};

exports.promisifyExe = function(command, args) {
	if (isWindows) {
		switch (command) {
			case 'npm':
				command = 'npm.cmd';
				break;
		}
	}
	return exports.promisifySpawn(command, args);
};
