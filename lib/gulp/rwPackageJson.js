const gutil = require('gulp-util');
const PluginError = gutil.PluginError;
const through = require('through2');
const Promise = require('bluebird');
const del = require('del');
const mkdirp = require('mkdirp');
const fs = require('fs');
const Path = require('path');
const File = require('vinyl');
const pkutil = require('../packageMgr/packageUtils');
const jsonLint = require('json-lint');
const log = require('log4js').getLogger(Path.basename(__filename, '.js'));
const _ = require('lodash');
const config = require('../config');
const isWin32 = require('os').platform().indexOf('win32') >= 0;

module.exports = {
	symbolicLinkPackages: symbolicLinkPackages,
	linkPkJson: linkPkJson, //deprecated
	addDependency: addDependency,
	removeDependency: removeDependency,
	readAsJson: readAsJson
};

const readFileAsync = Promise.promisify(fs.readFile);
//const writeFileAsync = Promise.promisify(fs.writeFile);
const accessAsync = Promise.promisify(fs.access);

/**
 * [readAsJson description]
 * @param  {function} onFile  [description]
 */
function readAsJson(toFile, onFlush) {
	return through.obj(function(file, encoding, callback) {
			gutil.log('reading ' + file.path);
			var self = this;
			readFileAsync(file.path, {encoding: 'utf-8'})
			.then(function(content) {
				var json = JSON.parse(content);
				return toFile(json, file);
			}).then(function(newFile) {
				callback(null, newFile);
			}).catch(function(err) {
				gutil.log(err);
				self.emit('error', new PluginError('rwPackageJson.readAsJson', err.stack, {showStack: true}));
				callback(err);
			});
		},
		function flush(callback) {
			onFlush();
			callback();
		}
	);
}

function symbolicLinkPackages(destDir) {
	return through.obj(function(file, encoding, callback) {
		var self = this;
		var newPath, json;
		Promise.coroutine(function*() {
			var content = yield readFileAsync(file.path, {encoding: 'utf-8'});
			var lint = jsonLint(content);
			if (lint.error) {
				log.error(lint);
				this.emit('error', new PluginError('rwPackageJson', lint, {showStack: true}));
				return callback();
			}
			json = JSON.parse(content);
			newPath = Path.resolve(destDir, 'node_modules', json.name);
			var stat, exists;
			try {
				stat = fs.lstatSync(newPath);
				exists = true;
			} catch (e) {
				if (e.code === 'ENOENT') {
					_symbolicLink(Path.dirname(file.path), newPath); // file doesn't exist, create a new link
					exists = false;
				} else
					throw e;
			}
			log.debug('symblink to %s', newPath);
			if (exists) {
				if (stat.isFile() ||
					(stat.isSymbolicLink() &&
						(stat.mtime.getTime() < file.stat.mtime.getTime() || !fileExists(newPath)))) {
					fs.unlinkSync(newPath);
					_symbolicLink(Path.dirname(file.path), newPath);
				} else if (stat.isDirectory()) {
					del.sync([newPath]);
					_symbolicLink(Path.dirname(file.path), newPath);
				}
			}
			self.push(new File({
				base: Path.resolve(destDir),
				path: newPath,
				contents: new Buffer(JSON.stringify(json, null, '\t'))
			}));
			callback();
		})()
		.catch(function(err) {
			log.error(err);
			self.emit('error', new PluginError('rwPackageJson', err.stack, {showStack: true}));
			callback(err);
		});
	}, function(callback) {
		callback();
	});
}

function fileExists(file) {
	try {
		fs.accessSync(file, fs.F_OK);
		return true;
	} catch (e) {
		return false;
	}
}

function _symbolicLink(dir, link) {
	mkdirp.sync(Path.dirname(link));
	fs.symlinkSync(Path.relative(Path.dirname(link), dir), link, isWin32 ? 'junction' : 'dir');
	log.info('create symbolic link %s', link);
}
/**
 * @deprecated
 * create new module which contains package.json that links to the module in `src` folder
 * @param  {string} destDir the `node_module` folder path
 */
function linkPkJson(destDir, recipeFile) {
	return through.obj(function(file, encoding, callback) {
		var self = this;
		var relativePath, newPath, json;
		readFileAsync(file.path, {encoding: 'utf-8'})
		.then(function(content) {
			var lint = jsonLint(content);
			if (lint.error) {
				log.error(lint);
				this.emit('error', new PluginError('rwPackageJson', lint, {showStack: true}));
				return callback();
			}
			json = JSON.parse(content);
			if (json.main) {
				relativePath = _relativeModulePath(file.path, json.main, destDir);
				//gutil.log('link attribute "main" to ' + relativePath);
				json.main = relativePath;
			}
			if (json.browser && _.isString(json.browser)) {
				relativePath = _relativeModulePath(file.path, json.browser, destDir);
				//gutil.log('link attribute "browser" to ' + relativePath);
				json.browser = relativePath;
			}
			if (json.style && _.isString(json.style)) {
				relativePath = _relativeModulePath(file.path, json.style, destDir);
				//gutil.log('link attribute "browser" to ' + relativePath);
				json.style = relativePath;
			}
			var packageNameObj = pkutil.parseName(json.name);
			newPath = Path.resolve(destDir, '@' + packageNameObj.scope,
				packageNameObj.name,
				'package.json');

			return accessAsync(newPath, fs.R_OK | fs.W_OK).then(function() {
				return true;
			}).catch(function() {
				return false;
			});
		})
		.then(function(exists) {
			var targetStat;
			if (exists) {
				targetStat = fs.statSync(newPath);
			}
			if (!exists || targetStat.mtime.getTime() < file.stat.mtime.getTime()) {
				// if linking package is outdated, we need to output package.json
				log.info('linking: ' + newPath);
				var newFile = new File({
					base: Path.resolve(destDir),
					path: newPath,
					contents: new Buffer(JSON.stringify(json, null, '\t'))
				});
				self.push(newFile);
				return null;
			} else {
				// if recipe file is outdated, we still need to output package.json
				return accessAsync(recipeFile, fs.R_OK | fs.W_OK).then(function() {
					return fs.statSync(recipeFile).mtime.getTime() < file.stat.mtime.getTime();
				}, function() {
					return true;
				}).then(function(recipeOutdated) {
					if (recipeOutdated) {
						var newFile = new File({
							base: Path.resolve(destDir),
							path: newPath,
							contents: new Buffer(JSON.stringify(json, null, '\t'))
						});
						self.push(newFile);
					}
				});
			}
		}).then(function() {
			callback();
		})
		.catch(function(err) {
			log.error(err);
			self.emit('error', new PluginError('rwPackageJson', err.stack, {showStack: true}));
			callback(err);
		});
	});
}

function _relativeModulePath(modulePath, origPath, destDir) {
	return Path.relative(
		Path.join(destDir, '@dr', 'someguy'),
		Path.join(Path.dirname(modulePath), origPath)).replace(/\\/g, '/');
}

var packageJsonTemp = {
	name: '@dr/',
	version: '0.0.0',
	description: 'Recipe package of ',
	dependencies: null
};

function addDependency(recipeDir, destJsonPath) {
	var linkFiles = [];
	var destJsonProm = accessAsync(destJsonPath, fs.R_OK | fs.W_OK)
	.then(function() {
		var content = fs.readFileSync(destJsonPath);
		var destJson = JSON.parse(content, 'utf8');
		return destJson;
	}, function() {
		var destJson = _.cloneDeep(packageJsonTemp);
		var relativeRecipeDir = Path.relative(config().rootPath, recipeDir);
		destJson.name += relativeRecipeDir.replace(/[\/\\]/g, '-');
		destJson.description += relativeRecipeDir;

		return destJson;
	});

	return through.obj(function(file, encoding, callback) {
		destJsonProm.then(function(destJson) {
			var json = JSON.parse(file.contents.toString('utf8'));

			log.debug('add to recipe: ' + recipeDir + ' : ' + file.path);
			linkFiles.push(Path.relative(config().rootPath, file.path));
			if (!destJson.dependencies) {
				destJson.dependencies = {};
			}
			destJson.dependencies[json.name] = json.version;
			//log.debug(destJson);
			callback();
		});
	}, function flush(callback) {
		var self = this;
		self.push(linkFiles);
		destJsonProm.then(function(destJson) {
			var destFile = new File({
				base: Path.resolve(config().rootPath),
				path: Path.resolve(destJsonPath),
				contents: new Buffer(JSON.stringify(destJson, null, '  '))
			});
			self.push(destFile);
			callback();
		});
	});
}

function removeDependency() {
	return through.obj(function(file, encoding, callback) {
		log.debug('removing dependencies from recipe file ' + file.path);
		var content = file.contents.toString('utf8');
		//read destJson
		var lint = jsonLint(content);
		if (lint.error) {
			log.error(lint);
			this.emit('error', lint.error);
			return callback();
		}
		var destJson = JSON.parse(content);
		// var promises = _.map(destJson.dependencies, (x, name) => {
		// 	return buildUtils.promisifyExe('npm', 'uninstall', name);
		// });
		destJson.dependencies = {};
		content = JSON.stringify(destJson, null, '\t');
		log.debug(content);
		file.contents = new Buffer(content);
		// Promise.all(promises).then(()=> {
		// 	callback(null, file);
		// });
		callback(null, file);
	});
}
