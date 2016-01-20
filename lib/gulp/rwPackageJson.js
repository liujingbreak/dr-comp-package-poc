var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
var through = require('through2');
var Q = require('q');
var fs = require('fs');
var Path = require('path');
var File = require('vinyl');
var pkutil = require('../packageMgr/packageUtils');

module.exports = {
	linkPkJson: linkPkJson,
	addDependeny: addDependeny,
	readAsJson: readAsJson
};

/**
 * [readAsJson description]
 * @param  {function} onFile  [description]
 */
function readAsJson(toFile, onFlush) {
	return through.obj(function transform(file, encoding, callback) {
			gutil.log('reading ' + file.path);
			Q.nfcall(fs.readFile, file.path, {encoding: 'utf-8'})
			.then(function(content) {
				var json = JSON.parse(content);
				return toFile(json, file);
			}).then(function(newFile) {
				callback(null, newFile);
			}).catch(function(err) {
				gutil.log(err);
				self.emit('error', new PluginError('rwPackageJson.readAsJson', err.stack, {showStack: true}));
			});
		},
		function flush(callback) {
			onFlush();
			callback();
		}
	);
}
/**
 * create new module which contains package.json that links to the module in `src` folder
 * @param  {string} destDir the `node_module` folder path
 */
function linkPkJson(destDir) {
	return through.obj(function(file, encoding, callback) {
		var self = this;
		var relativePath;
		Q.nfcall(fs.readFile, file.path, {encoding: 'utf-8'})
		.then(function(content) {
			var json = JSON.parse(content);
			if (json.main) {
				relativePath = _relativeModulePath(file.path, json.main, destDir);
				gutil.log('link attribute "main" to ' + relativePath);
				json.main = relativePath;
			}
			if (json.browser) {
				relativePath = _relativeModulePath(file.path, json.browser, destDir);
				gutil.log('link attribute "browser" to ' + relativePath);
				json.browser = relativePath;
			}
			var packageNameObj = pkutil.parseName(json.name);
			var newPath = Path.join('@' + packageNameObj.scope,
				packageNameObj.name,
				'package.json');
			gutil.log('writing path: ' + newPath);
			var newFile = createFile(
				newPath, '.', new Buffer(JSON.stringify(json, null, '\t')));
			self.push(newFile);

			callback();
		}).catch(function(err) {
			gutil.log(err);
			self.emit('error', new PluginError('rwPackageJson', err.stack, {showStack: true}));
		});
	});
}

function _relativeModulePath(modulePath, origPath, destDir) {
	return Path.relative(
		Path.join(destDir, '@dr', 'someguy'),
		Path.join(Path.dirname(modulePath), origPath));
}

function addDependeny(destJsonPath) {
	return through.obj(function(file, encoding, callback) {
		var json = JSON.parse(file.contents.toString());
		//read destJson
		var content = fs.readFileSync(destJsonPath);
		var destJson = JSON.parse(content);
		destJson.dependencies[json.name] = json.version;
		fs.writeFileSync(destJsonPath, JSON.stringify(destJson, null, '\t'));
		callback();
	});
}

function createFile(path, base, content) {
	return new File({
		base: base,
		path: path,
		contents: new Buffer(content)
	});
}
