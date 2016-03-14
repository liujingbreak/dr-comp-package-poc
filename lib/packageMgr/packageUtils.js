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
	findAllPackages: findAllPackages,
	browserResolve: browserResolve,
	eachInstalledRecipe: eachInstalledRecipe
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
	var resolvedPath = browserResolve(moduleName);
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
 * @callback packageFoundCallback(name, entryPath, parsedName, json, packagePath)
 * @param {string} name module name
 * @param {string} entryPath resolved file path
 * @param {Object<string, string>} parsedName object
 * @param {Object} json package.json Object
 * @param {string} packagePath package path
 */
/**
 * list linked browser side packages
 * @param  {[type]}   types    'core', 'builder', '*' or null
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

/**
 * @param {string[]} package name list, optional
 * @param  {packageFoundCallback} callback function(name, entryPath, parsedName, json, packagePath)
 */
function findAllPackages(packageList, callback) {
	if (arguments.length > 1 && _.isFunction(callback)) {
		callback = _filterByPackageName(packageList, callback);
	} else {
		callback = packageList;
	}

	function resolveAny(name) {
		var resolved = browserResolve(name);
		if (resolved == null) {
			return nodeResolve(name);
		}
		return resolved;
	}
	resolveAny.checkPackagJson = function(json) {
		return json.browser || json.main;
	};

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

/**
 * Iterate recipeSrcMapping and installedRecipes setting items
 * @param  {Function} callback function(recipeDir)
 * @return {[type]}            [description]
 */
function eachInstalledRecipe(callback) {
	var internalRecipe = Path.resolve(config().internalRecipeFolderPath);
	callback(internalRecipe);
	if (config().recipeSrcMapping) {
		_.forOwn(config().recipeSrcMapping, function(src, recipeDir) {
			callback(recipeDir);
		});
	}
	if (config().installedRecipes) {
		_.each(config().installedRecipes, callback);
	}
}

function _findPackageByType(types, callback, findEntryFilesFunc) {
	var callBackList = [];
	var packageSet = {};
	types = [].concat(types);
	// var internalRecipe = Path.resolve(config().internalRecipeFolderPath, 'package.json');
	// findEntryFiles(internalRecipe);
	//
	// if (config().recipeSrcMapping) {
	// 	_.forOwn(config().recipeSrcMapping, function(src, recipeDir) {
	// 		findEntryFiles(Path.resolve(config().rootPath, recipeDir, 'package.json'));
	// 	});
	// }

	eachInstalledRecipe(function(recipeDir) {
		findEntryFiles(Path.resolve(config().rootPath, recipeDir, 'package.json'));
	});

	// sort by priority
	callBackList = callBackList.sort(function(a, b) {
		return a.priority - b.priority;
	});
	callBackList.forEach(function(item) {
		callback.apply(this, item.params);
	});

	function findEntryFiles(recipe) {
		findEntryFilesFunc(recipe, function(name, entryPath, parsedName, pkJson, packagePath) {
			var packageType = pkJson.dr ? (pkJson.dr.type ? pkJson.dr.type : null) : null;
			if (_.includes(types, '*') || _.includes(types, packageType)) {
				_checkDuplicate(packageSet, name, parsedName, pkJson, packagePath);
				var packageContext = {
					priority: pkJson.dr ? (pkJson.dr.priority ? pkJson.dr.priority : 5000) : 5000,
					params: [name, entryPath, parsedName, pkJson, packagePath]
				};
				callBackList.push(packageContext);
				//log.debug(packageContext.params[0] + ' priority ' + packageContext.priority);
			}
		});
	}
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

function _filterByPackageName(packageList, callBack) {
	packageList = packageList ? [].concat(packageList) : null;
	var packageSet = {};
	if (packageList) {
		packageList.forEach(function(name) {
			packageSet[name] = true;
		});
	}

	return function(name, entryPath, parsedName, json, packagePath) {
		if (packageList === null || {}.hasOwnProperty.call(packageSet, parsedName.name) ||
			{}.hasOwnProperty.call(packageSet, name)) {
			callBack.apply(null, arguments);
		}
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
