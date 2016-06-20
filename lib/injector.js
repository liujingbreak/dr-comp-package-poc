var rj = require('require-injector');
var config = require('./config');
var log = require('log4js').getLogger('lib.injector');
var _ = require('lodash');
var fs = require('fs');
var Path = require('path');

module.exports = function(resolve, noNode) {
	var injector = rj({
		basedir: config.rootDir,
		resolve: resolve,
		debug: true,
		noNode: noNode
	});
	monkeyPatchRequireInjector(injector);
	return injector;
};

var packageNamePathMap = {};

var emptyFactoryMap = {
	factory: emptryChainableFunction,
	substitute: emptryChainableFunction,
	value:  emptryChainableFunction
};

function monkeyPatchRequireInjector(injector) {
	injector.addPackage = function(name, dir) {
		packageNamePathMap[name] = dir;
	};

	injector.fromPackage = function(name, dir) {
		if (dir) {
			this.addPackage(name, dir);
		}
		if (_.has(packageNamePathMap, name)) {
			return injector.fromDir(packageNamePathMap[name]);
		} else {
			log.debug('Injection for name is skipped');
			return emptyFactoryMap;
		}
	};

	injector.fromAllPackages = function() {
		return injector.fromDir(_.values(packageNamePathMap));
	};

	injector.fromAllComponents = function() {
		return injector.fromDir(_.values(packageNamePathMap));
	};

	/**
	 * @name injector.notFromPackages
	 * @param  {string|array} excludePackages
	 * @return {FactoryMap}
	 */
	injector.notFromPackages = function(excludePackages) {
		excludePackages = [].concat(excludePackages);
		var names = _.difference(_.keys(packageNamePathMap), excludePackages);
		var dirs = names.map(pkName => packageNamePathMap[pkName]);
		log.debug('from ' + dirs);
		return injector.fromDir(dirs);
	};

	/**
	 * read and evaluate inject setting file
	 * @param  {string} file optional, default is 'inject.js'
	 */
	injector.readInjectFile = function(fileName) {
		if (!fileName) {
			fileName = 'inject.js';
		}
		if (config().dependencyMode) {
			log.debug('execute internal ' + fileName);
			if (fs.existsSync(Path.resolve(__dirname, '..', fileName) )) {
				require('../' + fileName)(injector);
			}
		}
		var file = Path.resolve(config().rootPath, fileName);
		if (fs.existsSync(file)) {
			log.info('execute ' + file);
			require(config().rootPath.replace(/\\/g, '/') + '/' + fileName)(injector);
		} else {
			log.warn(file + ' doesn\'t exist');
		}
	};
	return injector;
}

function emptryChainableFunction() {
	return emptyFactoryMap;
}
