var packageUtils = require('./packageUtils');
var buildUtils = require('../gulp/buildUtils');
var config = require('../config');
var Package = require('./packageNodeInstance');
var NodeApi = require('../nodeApi');
var _ = require('lodash');
var log = require('log4js').getLogger('packageMgr.packageCompiler');

module.exports = compile;

function compile(argv) {
	require('@dr/environment')._setup(config, packageUtils, buildUtils); // monkey patch some useful objects
	var buildProm = Promise.resolve(null);
	packageUtils.findNodePackageByType('builder', function(name, entryPath, parsedName, pkJson, packagePath) {
		log.debug('find builder ' + name);
		buildProm = buildProm.then(function() {
			var pkInstance = new Package({
				moduleName: parsedName.name,
				name: name,
				longName: name,
				scope: parsedName.scope,
				path: packagePath
			});
			var api = new NodeApi(pkInstance.longName, pkInstance);
			api.constructor = NodeApi;
			pkInstance.api = api;
			NodeApi.prototype.buildUtils = buildUtils;
			NodeApi.prototype.argv = argv;
			NodeApi.prototype.compileNodePath = require('../nodeSearchPath').browserifyPaths;
			log.debug('run builder: ' + name);
			return runBuilder(name, api);
		}).catch(function(err) {
			log.error(err);
		});
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
			var job = Promise.defer();
			res.on('end', function() {
				log.debug('builder' + name + ' done');
				job.resolve();
			}).on('error', function(er) {
				log.debug(er);
				job.reject(er);
			});
			return job.promise;
		} else {
			return Promise.resolve(res);
		}
	}

	return buildProm;
}
