var fs = require('fs');
var Path = require('path');
var config = require('../config');
var mkdirp = require('mkdirp');
var Promise = require('bluebird');
var _ = require('lodash');
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

/**
 * Spawn process
 * @param  {string} command
 * @param  {array | string} ...args
 * @param  {object} opts optional
 *   - {boolean} opts.silent  child process's `stdout` and `stderr` stream will
 *   not pipe to process.stdout and stderr, returned promise will be resolved to
 *   string of stdout
 *   Other opts properties will be passed to child_process.spawn()
 *
 * @return {Promise}        rejected if child process exits with non-zero code
 */
exports.promisifySpawn = function(command, args) {
	var opts = arguments[arguments.length - 1];
	var commandEndPos = arguments.length;
	if (_.isString(opts)) {
		opts = {};
	} else {
		commandEndPos = arguments.length - 1;
	}
	if (!_.isArray(args)) {
		args = [].slice.call(arguments, 1, commandEndPos);
	}
	if (!opts) {
		opts = {};
	}

	if (!(opts && opts.silent)) {
		opts.stdio = 'inherit';
	}
	var spawn = require('child_process').spawn;

	return new Promise(function(resolve, reject) {
		var res = spawn(command, args, opts);
		var output;
		if (opts && opts.silent) {
			output = '';
			res.stdout.setEncoding('utf-8');
			res.stdout.on('data', (chunk)=> {
				output += chunk;
			});
			res.stderr.setEncoding('utf-8');
			res.stderr.on('data', (chunk)=> {
				output += chunk;
			});
		}
		res.on('error', () => {
			reject(output);
		});
		res.on('exit', function(code, signal) {
			if (code !== 0 ) {
				return reject(output);
			}
			resolve(output);
		});
	});
};

/**
 * @param  {string} command     [description]
 * @param  {...string | array} commandArgs ... arguments
 * @param  {object} opts optional
 *   - {boolean} opts.silent  child process's `stdout` and `stderr` stream will
 *   not pipe to process.stdout and stderr, returned promise will be resolved to
 *   string of stdout
 *
 * @return {Promise}        rejected if child process exits with non-zero code
 */
exports.promisifyExe = function(command, commandArgs) {
	var args = [].slice.call(arguments);
	if (isWindows) {
		switch (args[0]) {
			case 'npm':
				args[0] = 'npm.cmd';
				break;
		}
	}
	return exports.promisifySpawn.apply(this, args);
};

exports.getNpmVersion = function() {
	return exports.promisifyExe('npm', '-v', {silent: true})
	.then(raw => {
		return _.trim(raw);
	});
};

/**
 * Major version of `npm -v`
 * @return {Promise} resolved to number
 */
exports.npmMajorVersion = function() {
	return exports.getNpmVersion()
	.then(ver => {
		var major = /^([0-9]+)\./.exec(ver)[1];
		return parseInt(major, 10);
	});
};
