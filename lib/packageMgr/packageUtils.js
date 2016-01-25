var Path = require('path');
var fs = require('fs');
var _ = require('lodash');
var resolve = require('browser-resolve');
var config = require('../config');

module.exports = {
	parseName: parseName,
	findNodePackagePath: findNodePackagePath,
	findBrowserEntryFiles: findBrowserEntryFiles
};

var packageNameReg = /(?:@([^\/]+)\/)?(\S+)/;
/**
 * turn name like @<scope>/packageA into "packageA"
 * @param  {string} longName package name in package.json
 * @return {{scope: string, name: string}}
 */
function parseName(longName) {
	var ret = {name: longName};
	var match = packageNameReg.exec(longName);
	if (match) {
		ret.scope = match[1];
		ret.name = match[2];
	}
	return ret;
}

function jsChunkMap(mainPackageJson) {
	var map = {};
	var pj = JSON.parse(fs.readFileSync(mainPackageJson, 'utf-8'));
	if (!pj.dependencies) {
		return;
	}
	_.forOwn(pj.dependencies, function(version, name) {
		var parsedName = parseName(name);
		if (!_.includes(config().packageScopes, parsedName.scope)) {
			return;
		}
		var entryPath = resolve.sync(name);
		var packagePath = _recursiveLookupPackagejsonFolder(entryPath);
		var packageJson = Path.join(packagePath, 'package.json');
		var json = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
		var chunk = json.dr.chunk || json.dr.bundle;
		if (json.dr && chunk) {
			if (!map.hasOwnProperty(chunk)) {
				map[chunk] = [];
			}
			map[chunk].push(entryPath);
		}
	});
}

function findBrowserEntryFiles(mainPackageJson, eachCallback) {
	var pj = JSON.parse(fs.readFileSync(mainPackageJson, 'utf-8'));
	if (!pj.dependencies) {
		return;
	}
	_.forOwn(pj.dependencies, function(version, name) {
		var parsedName = parseName(name);
		if (!_.includes(config().packageScopes, parsedName.scope)) {
			return;
		}
		var entryPath = resolve.sync(name);
		var packagePath = _recursiveLookupPackagejsonFolder(entryPath);
		var packageJson = Path.join(packagePath, 'package.json');
		var json = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
		if (json.dr && json.dr.entry === true) {
			eachCallback(name, entryPath, parsedName);
		}
	});
}

function findBrowserPackagePath(moduleName) {
	var resolvedPath;
	resolvedPath = require.resolve(moduleName);
	var resolved = _recursiveLookupPackagejsonFolder(resolvedPath);
	return resolved;
}
/**
 * @param  {string} moduleName
 * @return {string|null} return null if not found
 */
function findNodePackagePath(moduleName) {
	var resolvedPath;
	try {
		resolvedPath = require.resolve(moduleName);
	} catch (er) {
		if (er.code === 'MODULE_NOT_FOUND') {
			return null;
		} else {
			throw er;
		}
	}
	var resolved = _recursiveLookupPackagejsonFolder(resolvedPath);
	return resolved;
}

function _recursiveLookupPackagejsonFolder(targetPath) {
	var path = targetPath;
	var folder = Path.dirname(path);
	while (!fs.existsSync(Path.join(folder, 'package.json'))) {
		var parentFolder = Path.dirname(folder);
		if (folder === parentFolder) {
			// root directory is reached
			throw new Error('package.json is not found for ' + targetPath);
		}
		folder = parentFolder;
	}
	return folder;
}
