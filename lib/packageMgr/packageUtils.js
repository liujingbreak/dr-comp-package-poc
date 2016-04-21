var Path = require('path');
var fs = require('fs');
var _ = require('lodash');
var resolve = require('resolve').sync;
var config = require('../config');
var log = require('log4js').getLogger('packageMgr.packageUtils');
module.exports = {
	parseName: parseName,
	is3rdParty: is3rdParty,
	findNodePackagePath: findNodePackagePath,
	findBrowserPackagePath: findBrowserPackagePath,
	findBrowserPackageByType: findBrowserPackageByType,
	findNodePackageByType: findNodePackageByType,
	findAllPackages: findAllPackages,
	browserResolve: browserResolve,
	eachRecipe: eachRecipe,
	lookForPackages: lookForPackages
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
 * @param  {[type]}   types    'core', 'builder', '*' or null, while '*' means
 *   any type, `null` means unkown type.
 * @param  {packageFoundCallback} callback called againts each found pacakge
 * @param {string} recipeType value of 'src', 'installed', or undefined
 * @return {number}  number of found pacakges
 */
function findBrowserPackageByType(types, callback, recipeType) {
	return _findPackageByType(types, callback, findBrowserEntryFiles, recipeType);
}
/**
 * list linked node side packages
 * @param  {[type]}   types    'core', 'builder', '*' or null, while '*' means
 *   any type, `null` means unkown type.
 * @param  {packageFoundCallback} callback called againts each found pacakge
 * @param {string} recipeType value of 'src', 'installed', or undefined
 * @return {number}  number of found pacakges
 */
function findNodePackageByType(types, callback, recipeType) {
	return _findPackageByType(types, callback, findNodeEntryFiles, recipeType);
}

/**
 * @param {string[]} optional, package name list (coulde be short name without scope part), `null` means "all packages"
 * @param  {packageFoundCallback} callback function(name, entryPath, parsedName, json, packagePath)
 */
function findAllPackages(packageList, callback, recipeType) {
	if (_.isFunction(callback)) {
		if (packageList) {
			lookForPackages([].concat(packageList), callback);
			return;
			//callback = _filterByPackageName(packageList, callback);
		}
	} else if (_.isFunction(packageList)) {
		// arguments.length <= 2
		callback = packageList;
		recipeType = arguments.length > 1 ? arguments[1] : null;
	}

	return _findPackageByType('*', callback, function(recipePackageJson, eachCallback) {
		return _findEntryFiles(recipePackageJson, eachCallback, resolveAny);
	}, recipeType);
}

function lookForPackages(packageList, callback) {
	packageList.forEach(name => {
		var entryPath = resolveAny(name);
		if (entryPath == null) {
			if (_.startsWith(name, '@')) {
				fullName = name;
				return;
			} else {
				var rightScope = config().packageScopes.some(scope => {
					entryPath = resolveAny('@' + scope + '/' + name);
					return entryPath;
				});
				if (!rightScope) {
					return;
				}
			}
		}
		var packagePath = _recursiveLookupPackagejsonFolder(entryPath);
		var packageJson = Path.join(packagePath, 'package.json');

		var json = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
		var fullName = json.name;
		if (!resolveAny.checkPackagJson(json)) {
			return;
		}
		var parsedName = parseName(fullName);
		callback(fullName, entryPath, parsedName, json, packagePath);
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
			log.trace('node resolve failed on ' + name);
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
	try {
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
			paths: require('../nodeSearchPath').browserifyPaths
		});
	} catch (e) {
		if (e.message.indexOf('Cannot find module') >= 0) {
			return null;
		}
		throw e;
	}
}
browserResolve.checkPackagJson = function(json) {
	return !!json.browser;
};

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

/**
 * Iterate recipeSrcMapping and installedRecipes setting items
 * @param  {Function} callback function(recipeDir)
 * @return {[type]}            [description]
 */
function eachRecipe(callback) {
	require('../gulp/recipeManager').eachRecipe(callback);
}

function _findPackageByType(types, callback, findEntryFilesFunc, recipeType) {
	//var callBackList = [];
	var packageSet = {};
	types = [].concat(types);

	if (recipeType === 'src') {
		require('../gulp/recipeManager').eachRecipeSrc((src, recipeDir) => {
			findEntryFiles(Path.resolve(config().rootPath, recipeDir, 'package.json'));
		});
	} else {
		eachRecipe((recipeDir) => {
			findEntryFiles(Path.resolve(config().rootPath, recipeDir, 'package.json'));
		});
	}
	// // sort by priority
	// callBackList = callBackList.sort(function(a, b) {
	// 	return a.priority - b.priority;
	// });
	// callBackList.forEach(function(item) {
	// 	callback.apply(this, item.params);
	// });

	function findEntryFiles(recipe) {
		findEntryFilesFunc(recipe, function(name, entryPath, parsedName, pkJson, packagePath) {
			var packageType = pkJson.dr ? (pkJson.dr.type ? pkJson.dr.type : null) : null;
			if (_.includes(types, '*') || _.includes(types, packageType)) {
				_checkDuplicate(packageSet, name, parsedName, pkJson, packagePath);
				// var packageContext = {
				// 	priority: pkJson.dr ? (pkJson.dr.priority ? pkJson.dr.priority : 5000) : 5000,
				// 	params: [name, entryPath, parsedName, pkJson, packagePath]
				// };
				//callBackList.push(packageContext);
				callback(name, entryPath, parsedName, pkJson, packagePath);
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

// function _filterByPackageName(packageList, callBack) {
// 	packageList = packageList ? [].concat(packageList) : null;
// 	var packageSet = {};
// 	if (packageList) {
// 		packageList.forEach(function(name) {
// 			packageSet[name] = true;
// 		});
// 	}
//
// 	return function(name, entryPath, parsedName, json, packagePath) {
// 		if (packageList === null || {}.hasOwnProperty.call(packageSet, parsedName.name) ||
// 			{}.hasOwnProperty.call(packageSet, name)) {
// 			callBack.apply(null, arguments);
// 		}
// 	};
// }

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
