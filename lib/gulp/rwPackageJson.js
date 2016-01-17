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
	addDependeny: addDependeny
};

function linkPkJson(destDir) {
	return through.obj(function(file, encoding, callback) {
		var me = this;
		Q.nfcall(fs.readFile, file.path, {encoding: 'utf-8'})
		.then(function(content) {
			var json = JSON.parse(content);
			if (json.main) {
				var relativePath = Path.relative(
					Path.join(destDir, '@dr', 'someguy'),
					Path.join(Path.dirname(file.path), json.main));
				gutil.log('link "main" to ' + relativePath);
				json.main = relativePath;
			}
			var packageNameObj = pkutil.parseName(json.name);
			var newPath = Path.join('@' + packageNameObj.scope,
				packageNameObj.name,
				'package.json');
			gutil.log('writing path: ' + newPath);
			var newFile = createFile(
				newPath, '.', new Buffer(JSON.stringify(json, null, '\t')));
			me.push(newFile);

			callback();
		}).catch(function(err) {
			gutil.log(err);
			me.emit('error', new PluginError('rwPackageJson', err.stack, {showStack: true}));
		});
	});
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
