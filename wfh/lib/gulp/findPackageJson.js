var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
var through = require('through2');
var File = require('vinyl');
var fs = require('fs');
var Path = require('path');
var Promise = require('bluebird');

module.exports = findPackageJson;

/**
 * Recursively lookup `file` folder for private module's package.json file
 */
function findPackageJson() {
	return through.obj(function(file, encoding, callback) {
		var me = this;
		var proms = [];
		checkFolder(file.path);
		//checkSubFolders(file.path);

		Promise.all(proms)
		.then(function() {
			callback();
		})
		.catch(function(err) {
			gutil.log(err);
			me.emit('error', new PluginError('findPackageJson', err.stack, {showStack: true}));
		});

		function checkSubFolders(parentDir) {
			var folders = fs.readdirSync(parentDir);
			folders.forEach(function(name) {
				try {
					if (name === 'node_modules') {
						return;
					}
					var dir = Path.join(parentDir, name);
					checkFolder(dir);
				} catch (er) {
					gutil.log(er);
				}
			});
		}

		function checkFolder(dir) {
			if (fs.statSync(dir).isDirectory()) {
				var pkJsonPath = Path.join(dir, 'package.json');
				if (fs.existsSync(pkJsonPath)) {
					var prom = createFile(pkJsonPath, file.path)
						.then(function(file) {
							return me.push(file);
						});
					proms.push(prom);
				} else {
					checkSubFolders(dir);
				}
			}
		}
	});
}

var fsStateAsync = Promise.promisify(fs.stat);
function createFile(path, base) {
	return fsStateAsync(path).then(function(stat) {
		return new File({
			base: base,
			path: path,
			stat: stat
		});
	});
}
