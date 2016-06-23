var packageUtils = require('./packageUtils');
var buildUtils = require('../gulp/buildUtils');
var config = require('../config');
var Package = require('./packageNodeInstance');
var NodeApi = require('../nodeApi');
var priorityHelper = require('./packagePriorityHelper');
var _ = require('lodash');
var log = require('log4js').getLogger('packageMgr.packageCompiler');
var rj = require('../injector');
var injector = rj(require.resolve);

module.exports = compile;

function compile(argv) {
	require('@dr/environment')._setup(config, packageUtils, buildUtils); // monkey patch some useful objects
	var packages = [];
	packageUtils.findNodePackageByType('builder', function(name, entryPath, parsedName, pkJson, packagePath) {
		log.debug('find builder ' + name);
		var pkInstance = new Package({
			moduleName: parsedName.name,
			name: name,
			longName: name,
			scope: parsedName.scope,
			path: packagePath,
			priority: pkJson.dr ? pkJson.dr.builderPriority : null
		});
		packages.push(pkInstance);
		injector.fromPackage(name, packagePath)
			.value('__injector', injector)
			.factory('__api', function() {
				return getApiForPackage(pkInstance);
			});
	});

	// packageUtils.findBrowserPackageByType('*', function(name, entryPath, parsedName, pkJson, packagePath) {
	// 	log.debug('inject for browser package ' + name);
	// 	injector.addPackage(name);
	// });
	injector.readInjectFile();

	var buildProm = priorityHelper.orderPackages(packages, pkInstance => {
		var api = getApiForPackage(pkInstance);
		log.debug('run builder: ' + pkInstance.longName);
		return runBuilder(pkInstance.longName, api);
	});

	function runBuilder(name, api) {
		var res;
		var packageExports = require(name);
		if (_.isFunction(packageExports.compile)) {
			res = packageExports.compile(api);
		} else {
			res = packageExports(packageUtils, config, argv);
		}
		if (res && _.isFunction(res.pipe)) {
			// is stream
			return new Promise((resolve, reject) => {
				res.on('end', function() {
					log.debug('builder' + name + ' done');
					resolve();
				}).on('error', function(er) {
					log.debug(er);
					reject(er);
				});
			});
		} else {
			return Promise.resolve(res);
		}
	}

	var apiCache = {};

	function getApiForPackage(pkInstance) {
		if (_.has(apiCache, pkInstance.longName)) {
			return apiCache[pkInstance.longName];
		}

		var api = new NodeApi(pkInstance.longName, pkInstance);
		api.constructor = NodeApi;
		pkInstance.api = api;
		NodeApi.prototype.buildUtils = buildUtils;
		NodeApi.prototype.packageUtils = packageUtils;
		NodeApi.prototype.argv = argv;
		NodeApi.prototype.compileNodePath = require('../nodeSearchPath').browserifyPaths;
		apiCache[pkInstance.longName] = api;
		return api;
	}

	return buildProm;
}
