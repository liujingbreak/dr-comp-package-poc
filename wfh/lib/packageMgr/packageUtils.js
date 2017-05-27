var Path = require('path');
var fs = require('fs');
var _ = require('lodash');
var resolve = require('resolve').sync;
var config = require('../config');
var log = require('log4js').getLogger('wfh.packageUtils');
var chalk = require('chalk');
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

var moduleNameReg = /^(?:@([^\/]+)\/)?(\S+)/; // content can be (@<scope>)/(<name>/<path>)...
var packageNameReg = /^((?:@[^\/]+\/)?[^\/]+)(?:\/(.+?))?$/; // content can be (@<scope>/<name>)/(<path>)

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
	var match = moduleNameReg.exec(longName);
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
	var match = packageNameReg.exec(moduleName);
	moduleName = match[1];
	var pkFile = browserResolve(moduleName + '/package.json');
	return pkFile ? Path.dirname(pkFile) : null;
}
/**
 * @param  {string} moduleName
 * @return {string|null} return null if not found
 */
function findNodePackagePath(moduleName) {
	var resolvedPath;
	var match = packageNameReg.exec(moduleName);
	moduleName = match[1];
	try {
		resolvedPath = require.resolve(moduleName + '/package.json');
		return Path.dirname(resolvedPath);
	} catch (er) {
		log.error(er);
		return null;
	}
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
 * @param {string[]} optional, package name list (coulde be short name without scope part), if it is not present meaning "all packages"
 * @param {string} recipeType value of 'src', 'installed', or undefined
 * @param {string} project (optional) the project folder which is stored in dr.project.list.json
 * @param  {packageFoundCallback} callback function(name, entryPath, parsedName, json, packagePath)
 */
function findAllPackages(packageList, callback, recipeType, projectDir) {
	if (_.isFunction(callback) && packageList) {
		lookForPackages([].concat(packageList), callback);
		return;
	} else if (_.isFunction(packageList)) {
		// arguments.length <= 2
		projectDir = recipeType;
		recipeType = callback;
		callback = packageList;
	}

	return _findPackageByType('*', callback, function(recipePackageJson, eachCallback) {
		return _findEntryFiles(recipePackageJson, eachCallback, resolveAny);
	}, recipeType, projectDir);
}

function lookForPackages(packageList, callback) {
	[].concat(packageList).forEach(name => {
		var fullName = name;
		var packagePath = findBrowserPackagePath(fullName);

		if (packagePath == null) {
			if (!_.startsWith(name, '@')) {
				var tryName;
				var found = config().packageScopes.some(scope => {
					tryName = '@' + scope + '/' + name;
					packagePath = findBrowserPackagePath(tryName);
					return packagePath;
				});
				if (found) {
					fullName = tryName;
				}
			}
		}
		if (packagePath == null) {
			throw new Error(`Package ${fullName} is not found`);
		}
		var entryPath = resolveAny(fullName);
		var packageJson = Path.join(packagePath, 'package.json');

		var json = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
		fullName = json.name;
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

		var packagePath = resolveFn.findPackagePath(name);
		if (!packagePath) {
			log.info('Package %s does not exist, you may need to install it', chalk.red(name));
			return;
		}
		var packageJson = Path.join(packagePath, 'package.json');
		var json = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
		// if (!resolveFn.checkPackagJson(json)) {
		// 	return;
		// }
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
nodeResolve.findPackagePath = findNodePackagePath;
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
			paths: [config().nodePath] //require('../nodeSearchPath').browserifyPaths
		});
	} catch (e) {
		if (e.message.indexOf('Cannot find module') >= 0) {
			return null;
		}
		throw e;
	}
}
browserResolve.findPackagePath = findBrowserPackagePath;
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
resolveAny.findPackagePath = findBrowserPackagePath;

resolveAny.checkPackagJson = function(json) {
	return json.browser || json.main;
};

/**
 * Iterate project src folder and installedRecipes setting items
 * @param  {Function} callback function(recipeDir)
 * @return {[type]}            [description]
 */
function eachRecipe(callback) {
	require('../gulp/recipeManager').eachRecipe(callback);
}

function _findPackageByType(types, callback, findEntryFilesFunc, recipeType, projectDir) {
	//var callBackList = [];
	var packageSet = {};
	types = [].concat(types);

	if (recipeType === 'src') {
		require('../gulp/recipeManager').eachRecipeSrc(projectDir, onEachSrcRecipe);
	} else {
		eachRecipe((recipeDir) => {
			findEntryFiles(Path.resolve(recipeDir, 'package.json'));
		});
	}

	function onEachSrcRecipe(src, recipeDir) {
		if (recipeDir)
			findEntryFiles(Path.resolve(recipeDir, 'package.json'));
	}

	function findEntryFiles(recipe) {
		findEntryFilesFunc(recipe, function(name, entryPath, parsedName, pkJson, packagePath) {
			if (!_.has(pkJson, 'dr') && !_.includes(config().packageScopes, parsedName.scope))
				return;
			var packageType = _.get(pkJson, 'dr.type');
			packageType = packageType ? [].concat(packageType) : [];

			if (_.includes(types, '*') || _.intersection(types, packageType).length > 0) {
				_checkDuplicate(packageSet, name, parsedName, pkJson, packagePath);
				callback(name, entryPath, parsedName, pkJson, packagePath);
			}
		});
	}
}

function _checkDuplicate(packageSet, name, parsedName, pkJson, packagePath) {
	if (_.has(packageSet, parsedName.name) && packageSet[parsedName.name].packagePath !== packagePath) {
		var existing = packageSet[parsedName.name];
		throw new Error('Duplicate package short name found: ' + name +
			' (' + packagePath + ')' +
			' and ' + existing.longName + '(' + existing.packagePath + ').\n' +
			'Short name means the part of package name without scope name');
	}
	packageSet[parsedName.name] = {
		longName: name,
		packagePath: packagePath
	};
}
