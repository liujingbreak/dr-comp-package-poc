var Path = require('path');
var fs = require('fs');
var _ = require('lodash');
var resolve = require('resolve').sync;
var config = require('../config');
var log = require('log4js').getLogger('packageMgr.packageUtils');
var win32 = process.platform === 'win32';

module.exports = {
	parseName: parseName,
	is3rdParty: is3rdParty,
	findNodePackagePath: findNodePackagePath,
	findBrowserPackagePath: findBrowserPackagePath,
	findBrowserPackageByType: findBrowserPackageByType,
	findNodePackageByType: findNodePackageByType,
	findAllPackages: findAllPackages
	//findBrowserEntryFiles: findBrowserEntryFiles
};

var packageNameReg = /(?:@([^\/]+)\/)?(\S+)/;

var packageScopeSet = {};
config().packageScopes.forEach(function(scope) {
	packageScopeSet[scope] = true;
});

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

function is3rdParty(packageName) {
	var p = parseName(packageName);
	return !{}.hasOwnProperty.call(packageScopeSet, p.scope);
}

function findBrowserPackagePath(moduleName) {
	var resolvedPath = resolve.sync(moduleName);
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
/**
 * @callback packageFoundCallback
 * @param {string} name module name
 * @param {string} resolved file path
 * @param {Object<string, string>} parsedName object
 * @param {Object} package.json Object
 * @param {string} package path
 */
/**
 * list linked browser side packages
 * @param  {[type]}   types    'core', 'builder' or null
 * @param  {packageFoundCallback} callback called againts each found pacakge
 * @return {number}  number of found pacakges
 */
function findBrowserPackageByType(types, callback) {
	return _findPackageByType(types, callback, findBrowserEntryFiles);
}
/**
 * list linked node side packages
 * @param  {[type]}   types    'core', 'builder', '*' or null, while '*' means
 *   any type, `null` means unkown type.
 * @param  {packageFoundCallback} callback called againts each found pacakge
 * @return {number}  number of found pacakges
 */
function findNodePackageByType(types, callback) {
	return _findPackageByType(types, callback, findNodeEntryFiles);
}

function findAllPackages(callback) {
	function resolveAny(name) {
		var resolved = browserResolve(name);
		if (resolved == null) {
			return nodeResolve(name);
		}
		return resolved;
	}

	return _findPackageByType('*', callback, function(recipePackageJson, eachCallback) {
		return _findEntryFiles(recipePackageJson, eachCallback, resolveAny);
	});
}

function _findEntryFiles(recipePackageJson, eachCallback, resolveFn) {
	var pj = JSON.parse(fs.readFileSync(recipePackageJson, 'utf-8'));
	if (!pj.dependencies) {
		return;
	}
	_.forOwn(pj.dependencies, function(version, name) {
		var parsedName = parseName(name);
		var entryPath = resolveFn(name);
		if (entryPath == null) {
			return;
		}
		var packagePath = _recursiveLookupPackagejsonFolder(entryPath);
		var packageJson = Path.join(packagePath, 'package.json');
		var json = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
		if (!resolveFn.checkPackagJson(json)) {
			return;
		}
		eachCallback(name, entryPath, parsedName, json, packagePath);
	});
}
/**
 * [findBrowserEntryFiles description]
 * @param  {[type]} recipePackageJson [description]
 * @param  {[type]} eachCallback    [description]
 * @return {[type]}                 [description]
 */
function findBrowserEntryFiles(recipePackageJson, eachCallback) {
	return _findEntryFiles(recipePackageJson, eachCallback, browserResolve);
}

function findNodeEntryFiles(recipePackageJson, eachCallback) {
	return _findEntryFiles(recipePackageJson, eachCallback, nodeResolve);
}

function nodeResolve(name) {
	try {
		return require.resolve(name);
	} catch (er) {
		if (er.code === 'MODULE_NOT_FOUND') {
			return null;
		} else {
			throw er;
		}
	}
}
nodeResolve.checkPackagJson = function(json) {
	return !!json.main;
};

function browserResolve(file) {
	return resolve(file, {
		basedir: config().rootPath,
		extensions: ['.js', '.less', '.css'],
		packageFilter: function packageFilter(info, pkgdir) {
			if (info.browser) {
				info.main = info.browser;
				return info;
			}

			// replace main
			if (typeof info.style === 'string') {
				info.main = info.style;
				return info;
			}

			return info;
		},
		paths: process.env.NODE_PATH ? process.env.NODE_PATH.split(win32 ? ';' : ':') : []
	});
}
browserResolve.checkPackagJson = function(json) {
	return !!json.browser;
};

function _findPackageByType(types, callback, findEntryFilesFunc) {
	var packageSet = {};
	types = [].concat(types);
	var internalRecipe = Path.resolve(config().internalRecipeFolderPath, 'package.json');
	findEntryFilesFunc(internalRecipe, function(name, entryPath, parsedName, pkJson, packagePath) {
		var packageType = pkJson.dr ? (pkJson.dr.type ? pkJson.dr.type : null) : null;
		if (_.includes(types, '*') || _.includes(types, packageType)) {
			_checkDuplicate(packageSet, name, parsedName, pkJson, packagePath);
			callback(name, entryPath, parsedName, pkJson, packagePath);
		}
	});

	if (!config().recipeFolderPath || config().recipeFolderPath === config().internalRecipeFolderPath) {
		return;
	}
	var recipe = Path.resolve(config().recipeFolderPath, 'package.json');
	findEntryFilesFunc(recipe, function(name, entryPath, parsedName, pkJson, packagePath) {
		var packageType = pkJson.dr ? (pkJson.dr.type ? pkJson.dr.type : null) : null;
		if (_.includes(types, '*') || _.includes(types, packageType)) {
			_checkDuplicate(packageSet, name, parsedName, pkJson, packagePath);
			callback(name, entryPath, parsedName, pkJson, packagePath);
		}
	});
}

function _checkDuplicate(packageSet, name, parsedName, pkJson, packagePath) {
	if ({}.hasOwnProperty.call(packageSet, parsedName.name)) {
		var existing = packageSet[parsedName.name];
		throw new Error('Duplicate package name found: ' + name +
			' (' + packagePath + ')' +
			' and ' + existing.longName + '(' + existing.packagePath + ')');
	}
	packageSet[parsedName.name] = {
		longName: name,
		packagePath: packagePath
	};
}



function _recursiveLookupPackagejsonFolder(targetPath) {
	if (!targetPath) {
		throw new Error('targetPath can not be null');
	}
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
