var Path = require('path');
var _ = require('lodash');
var api = require('__api');
var log = require('log4js').getLogger(api.packageName + '.compilerApi');
var chalk = require('chalk');
var resolveStaticUrl = require('@dr-core/browserify-builder-api').resolveUrl;

module.exports = function() {
	var proto = Object.getPrototypeOf(api);
	proto.findBrowserPackageByPath = findBrowserPackageByPath;
	proto.findBrowserPackageInstanceByPath = findBrowserPackageInstanceByPath;
	proto.packageNames2bundles = packageNames2bundles;
	proto.replaceAssetsUrl = replaceAssetsUrl;
	initPackageListInfo(proto);
};

function initPackageListInfo(proto) {
	proto._packagePathList = [];
	proto._packagePath2Name = {};

	proto.packageInfo.allModules.forEach((instance, idx) => {
		if (!instance.packagePath) {
			return;
		}
		function storePath(packagePath) {
			var path = Path.relative(proto.config().rootPath, packagePath);
			if (Path.sep === '\\') {
				path = path.replace(/\\/g, '/');
			}
			if (!_.endsWith(path, '/')) {
				path = path + '/';
			}
			proto._packagePath2Name[path] = instance;
			proto._packagePathList.push(path);
		}
		storePath(instance.packagePath);
		if (instance.realPackagePath !== instance.packagePath)
			storePath(instance.realPackagePath);
	});
	proto._packagePathList.sort();
}


function findBrowserPackageByPath(file) {
	return this.findBrowserPackageInstanceByPath(file).longName;
}

function findBrowserPackageInstanceByPath(file) {
	file = Path.relative(this.config().rootPath, file).replace(/\\/g, '/');

	var idx = _.sortedIndex(this._packagePathList, file);
	if (idx === 0 || !file.startsWith(this._packagePathList[idx - 1])) {
		throw new Error('file ' + file + ' doesn\'t belong to any of our private packages');
	} else {
		return this._packagePath2Name[this._packagePathList[idx - 1]];
	}
}

function replaceAssetsUrl(str, sourceFile) {
	var self = this;
	return str.replace(/([^a-zA-Z\d_.]|^)assets:\/\/((?:@[^\/]+\/)?[^\/]+)?(\/.*?)(['"),;:!\s]|$)/gm,
		(match, leading, packageName, path, tail) => {
			if (!packageName || packageName === '') {
				packageName = self.findBrowserPackageByPath(sourceFile);
			}
			if (packageName) {
				if (sourceFile) {
					var injectedName = getInjectedPackage(sourceFile, packageName);
					if (injectedName) {
						log.info(`replace assets package ${packageName} to injected ${injectedName}`);
						packageName = injectedName;
					}
				}
			}
			var resolvedUrl = resolveStaticUrl(api.config, packageName, path);
			log.info('In file: %s\nresolve assets URL "%s" to "%s"', sourceFile, packageName + path, resolvedUrl);
			return leading + resolvedUrl + tail;
		});
}

function getInjectedPackage(file, origPackageName) {
	var factoryMap = api.browserInjector.factoryMapForFile(file);
	if (factoryMap) {
		var ij = factoryMap.getInjector(origPackageName);
		if (ij && _.has(ij, 'substitute')) {
			//log.debug(`Found less import target: ${origPackageName}, replaced to ${ij.substitute}`);
			return ij.substitute;
		}
	}
	return null;
}

function packageNames2bundles(packageNames) {
	var moduleMap = this.packageInfo.moduleMap;
	var bundleSet = {};

	_.forEach(packageNames, name => {
		if (!{}.hasOwnProperty.call(moduleMap, name)) {
			if (_.startsWith(name, '@')) {
				log.warn(chalk.yellow('Browser package cannot be found: ' + name));
				return;
			} else {
				// guess the package scope name
				var guessingName;
				if (_.some(this.config().packageScopes, function(scope) {
					guessingName = '@' + scope + '/' + name;
					return {}.hasOwnProperty.call(moduleMap, guessingName);
				})) {
					name = guessingName;
				} else {
					log.warn(chalk.yellow('Browser package cannot be found: ' + name));
					return;
				}
			}
		}
		bundleSet[moduleMap[name].bundle] = true;
	});
	var bundles = _.keys(bundleSet);
	return bundles;
}
