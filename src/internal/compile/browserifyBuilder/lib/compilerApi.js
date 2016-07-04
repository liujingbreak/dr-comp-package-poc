var Path = require('path');
var _ = require('lodash');
var api = require('__api');
var log = require('log4js').getLogger(api.packageName + '.compilerApi');
var chalk = require('chalk');

module.exports = function() {
	var proto = Object.getPrototypeOf(api);
	proto.findBrowserPackageByPath = findBrowserPackageByPath;
	proto.findBrowserPackageInstanceByPath = findBrowserPackageInstanceByPath;
	proto.packageNames2bundles = packageNames2bundles;
	require('@dr/environment').findBrowserPackageByPath = findBrowserPackageByPath.bind(proto);
	initPackageListInfo(proto);
};

function initPackageListInfo(proto) {
	proto._packagePathList = [];
	proto._packagePath2Name = {};

	proto.packageInfo.allModules.forEach((instance, idx) => {
		if (!instance.packagePath) {
			return;
		}
		var path = Path.relative(proto.config().rootPath, instance.packagePath);
		if (Path.sep === '\\') {
			path = path.replace(/\\/g, '/');
		}
		if (!_.endsWith(path, '/')) {
			path = path + '/';
		}
		proto._packagePath2Name[path] = instance;
		proto._packagePathList.push(path);
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
