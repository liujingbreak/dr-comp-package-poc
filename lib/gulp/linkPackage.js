var fs = require('fs');
var gutil = require('gulp-util');
var log = gutil.log;
var mkdirs = require('mkdirs');
var pkutil = require('../packageMgr/packageUtils');
var Q = require('q');
var Path = require('path');

module.exports = linkPackageJson;

var mainPackageJson;

function linkPackageJson(parentDir) {
	var folders = fs.readdirSync(parentDir);
	var qs = [];
	folders.forEach(function(name) {
		var dir = Path.join(parentDir, name);
		if (fs.statSync(dir).isDirectory()) {
			var pkJsonPath = Path.join(dir, 'package.json');
			if (fs.existsSync(pkJsonPath)) {
				qs.push(_replicatePackageJson(pkJsonPath));
			} else {
				qs = qs.concat(linkPackageJson(dir));
			}
		}
	});
	return qs;
}

function _replicatePackageJson(oldPath) {
	log('found ' + oldPath);
	return Q.nfcall(fs.readFile, oldPath, {encoding: 'utf-8'})
	.then(function(content) {
		var json = JSON.parse(content);
		if (json.main) {
			var relativePath = Path.relative(
				Path.join('node_modules', '@dr', 'someguy'),
				Path.join(Path.dirname(oldPath), json.main));
			log('link "main" to ' + relativePath);
			json.main = relativePath;
		}
		var packageNameObj = pkutil.parseName(json.name);
		var newDir = Path.join('node_modules',
			'@' + packageNameObj.scope,
			packageNameObj.name);
		mkdirs(newDir);
		var newPackageJson = Path.join(newDir, 'package.json');
		log('write to ' + newPackageJson);
		return Q.nfcall(fs.writeFile, newPackageJson,
			JSON.stringify(json, null, '\t'));
	});
}
