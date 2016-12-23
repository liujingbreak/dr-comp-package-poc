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

		storePath(instance.packagePath);
		if (instance.realPackagePath !== instance.packagePath)
			storePath(instance.realPackagePath);

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
	});
	proto._packagePathList.sort();
}


function findBrowserPackageByPath(file) {
	return _.get(this.findBrowserPackageInstanceByPath(file), 'longName');
}

function findBrowserPackageInstanceByPath(file) {
	file = Path.relative(this.config().rootPath, file).replace(/\\/g, '/');

	var idx = _.sortedIndex(this._packagePathList, file);
	if (idx === 0 || !file.startsWith(this._packagePathList[idx - 1])) {
		//throw new Error('file ' + file + ' doesn\'t belong to any of our private packages');
		return null; // Return null if a file does not belong to our packages
	} else {
		return this._packagePath2Name[this._packagePathList[idx - 1]];
	}
}

function replaceAssetsUrl(str, sourceFile) {
	var self = this;
	return str.replace(/([^a-zA-Z\d_.]|^)assets:\/\/((?:@[^\/]+\/)?[^\/]+)?(\/.*?)(['"),;:!\s\\]|$)/gm,
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
	var fmaps = api.browserInjector.factoryMapsForFile(file);
	var replaced = null;
	_.some(fmaps, factoryMap => {
		var ijSetting = factoryMap.matchRequire(origPackageName);
		if (ijSetting && ijSetting.method === 'substitute') {
			if (_.isFunction(ijSetting.value)) {
				replaced = ijSetting.value(file, ijSetting.execResult);
			} else {
				replaced = ijSetting.value;
			}
			return true;
		}
		return false;
	});
	return replaced;
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
