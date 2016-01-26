var Path = require('path');
var fs = require('fs');
var _ = require('lodash');
var resolve = require('browser-resolve');
var config = require('../config');
var log = require('log4js').getLogger('packageMgr.packageUtils');

module.exports = {
	parseName: parseName,
	findNodePackagePath: findNodePackagePath,
	findBrowserEntryFiles: findBrowserEntryFiles,
	bundleModuleMap: bundleModuleMap
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
		if (json.main) {
			eachCallback(name, entryPath, parsedName);
		}
	});
}

/**
 * @return {Object.<string, array>}  key is bundle name, value is array of Object,
 *  {string} .longName - full module name,
 *  {string} .file - file path
 *  {string} .shortName - module name without scope prefix
 */
function bundleModuleMap(packageJsonFile) {
	var pj = JSON.parse(fs.readFileSync(packageJsonFile, 'utf-8'));
	if (!pj.dependencies) {
		return {};
	}

	var map = mergeVendorBundleMap();
	log.debug('bundleMap() ' + JSON.stringify(map));

	_.forOwn(pj.dependencies, function(version, name) {
		var parsedName = parseName(name);
		var bundle;
		if (!_.includes(config().packageScopes, parsedName.scope)) {
			return;
		}
		var depPackageJson = JSON.parse(fs.readFileSync(Path.join(
			findBrowserPackagePath(name), 'package.json'), 'utf-8'));
		if (!depPackageJson.browser) {
			return;
		}
		if (!depPackageJson.dr) {
			bundle = parsedName.name;
		} else {
			bundle = depPackageJson.dr.bundle || depPackageJson.dr.chunk;
			bundle = bundle ? bundle : parsedName.name;
		}
		if (!map.hasOwnProperty(bundle)) {
			map[bundle] = [];
		}
		map[bundle].push({
			longName: name,
			file: resolve.sync(name),
			shortName: parsedName.name
		});
	});
	return map;
}

function mergeVendorBundleMap(map) {
	var vendorMap = config().vendorBundleMap;
	if (!map) {
		map = {};
	}
	_.forOwn(vendorMap, function(moduleNames, bundle) {
		var mapped = _.map(moduleNames, function(moduleName) {
			return {
				longName: moduleName,
				shortName: moduleName,
				file: resolve.sync(moduleName)
			};
		});
		map[bundle] = mapped;
	});
	return map;
}

function findBrowserPackagePath(moduleName) {
	var resolvedPath;
	resolvedPath = resolve.sync(moduleName);
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
			log.info('node require() MODULE_NOT_FOUND: ' + moduleName);
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
