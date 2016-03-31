var Path = require('path');
var _ = require('lodash');
var log = require('log4js').getLogger(Path.basename(__filename, '.js'));
var chalk = require('chalk');

module.exports = function(api) {
	var proto = api.__proto__;
	proto.findBrowserPackageByPath = findBrowserPackageByPath;
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
		proto._packagePath2Name[path] = instance.longName;
		proto._packagePathList.push(path);
	});
	proto._packagePathList.sort();
}


function findBrowserPackageByPath(file) {
	file = Path.relative(this.config().rootPath, file);
	var idx = _.sortedIndex(this._packagePathList, file);

	if (!file.startsWith(this._packagePathList[idx - 1])) {
		log.debug('file ' + file + ' doesn\'t belong to any of our private packages');
		return null;
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
