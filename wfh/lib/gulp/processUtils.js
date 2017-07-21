var isWindows = process.platform === 'win32';
//var Promise = require('bluebird');
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
	if (typeof opts === 'string') {
		opts = {};
	} else {
		commandEndPos = arguments.length - 1;
	}
	if (!Array.isArray(args)) {
		args = [].slice.call(arguments, 1, commandEndPos);
	}
	if (!opts) {
		opts = {};
	}

	if (!(opts && opts.silent)) {
		opts.stdio = 'inherit';
	}
	var spawn = require('child_process').spawn;
	var res;
	return new Promise((resolve, reject) => {
		res = spawn(command, args, opts);
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
			reject(new Error(output));
		});
		res.on('exit', function(code, signal) {
			if (code !== 0 ) {
				reject(new Error(output));
			}
			resolve(output);
		});
	})
	//.timeout(10 * 60000, `"${command} ${args.join(' ')}" timeout`)
	.catch(Promise.TimeoutError, e => {
		console.log(e);
		if (res) {
			console.log('Kill the child process');
			res.kill('SIGHUP');
		}
		throw e;
	});
};

/**
 * Fix some executable command for windows
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
			case 'yarn':
			case 'gulp':
				args[0] += '.cmd';
				break;
		}
	}
	return exports.promisifySpawn.apply(this, args);
};
