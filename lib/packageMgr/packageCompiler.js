var packageUtils = require('./packageUtils');
var buildUtils = require('../gulp/buildUtils');
var config = require('../config');
var Package = require('./packageNodeInstance');
var NodeApi = require('../nodeApi');
var priorityHelper = require('./packagePriorityHelper');
var _ = require('lodash');
var log = require('log4js').getLogger('packageMgr.packageCompiler');
var rj = require('../injectorFactory');
var Promise = require('bluebird');
var http = require('http');
var injector = rj(require.resolve);

module.exports = compile;
module.exports.listPackages = listPackages;
var apiCache = {};

function compile(argv) {
	var packages = _listPackages((pkInstance, name, entryPath, parsedName, pkJson, packagePath) => {
		injector.fromPackage(name, packagePath)
			.value('__injectorFactory', rj)
			.value('__injector', injector)
			.factory('__api', function() {
				return getApiForPackage(pkInstance);
			});
	});
	injector.readInjectFile();
	//var packages = _listPackages();
	var buildProm = priorityHelper.orderPackages(packages, pkInstance => {
		var api = getApiForPackage(pkInstance);
		log.debug('run builder: ' + pkInstance.longName);
		return runBuilder(pkInstance.longName, api);
	});

	if (config.get('devMode') === true) {
		buildProm = buildProm.then(buildRes => {
			return new Promise((resolve, reject) => {
				var req = http.request({
					method: 'GET',
					hostname: 'localhost',
					port: config.get('livereload.port'),
					path: '/changed?files=XXX.js'
				}, response => {
					response.on('data', (chunk) => {
						log.info(chunk.toString('utf8'));
					});
					response.resume();
					response.on('end', () => resolve(buildRes));
				})
				.on('error', err => resolve(buildRes)); // Never mind, server is not on.
				req.end();
			});
		});
	}

	function runBuilder(name, api) {
		var res;
		var packageExports = require(name);
		if (_.isFunction(packageExports.compile)) {
			res = packageExports.compile(api);
		} else if (_.isFunction(packageExports)){
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

	function getApiForPackage(pkInstance) {
		if (_.has(apiCache, pkInstance.longName)) {
			return apiCache[pkInstance.longName];
		}

		var api = new NodeApi(pkInstance.longName, pkInstance);
		api.constructor = NodeApi;
		pkInstance.api = api;
		var proto = NodeApi.prototype;
		proto.buildUtils = buildUtils;
		proto.packageUtils = packageUtils;
		proto.argv = argv;
		proto.compileNodePath = require('../nodeSearchPath').browserifyPaths;
		proto.getBuildLocale = getBuildLocale;
		proto.localeBundleFolder = localeBundleFolder;
		proto.isDefaultLocale = isDefaultLocale;
		apiCache[pkInstance.longName] = api;
		return api;
	}

	return buildProm;
}

function listPackages() {
	var util = require('util');
	var packages = _listPackages();
	var idx = 0;
	var maxNameLe = _.maxBy(packages, pk => pk.longName.length).longName.length;
	var list = [];
	return Promise.coroutine(function*() {
		yield priorityHelper.orderPackages(packages, pk => {
			idx++;
			var gapLen = maxNameLe - pk.longName.length;
			var gap = new Array(gapLen);
			_.fill(gap, ' ');
			list.push({
				pk: pk,
				desc: util.format('%d. %s %s priority: %s', idx, pk.longName, gap.join(''), pk.priority),
			});
		});
		return list;
	})();
}

function _listPackages(onEachPackage) {
	var packages = [];
	packageUtils.findNodePackageByType('*', (name, entryPath, parsedName, pkJson, packagePath) => {
		var types = [].concat(_.get(pkJson, 'dr.type'));
		var isBuilder = _.includes(types, 'builder');
		var pkInstance = new Package({
			moduleName: parsedName.name,
			name: name,
			longName: name,
			scope: parsedName.scope,
			path: packagePath,
			json: pkJson,
			priority: isBuilder ? pkJson.dr.builderPriority : _.get(pkJson, 'dr.serverPriority')
		});
		if (isBuilder)
			packages.push(pkInstance);
		if (onEachPackage)
			onEachPackage(pkInstance, name, entryPath, parsedName, pkJson, packagePath);
	});
	return packages;
}

function getBuildLocale() {
	return this.argv.locale || this.config.get('locales[0]');
}

function localeBundleFolder() {
	return this.config.get('locales[0]') === this.getBuildLocale() ? '' : this.getBuildLocale() + '/';
}

function isDefaultLocale() {
	return this.config.get('locales[0]') === this.getBuildLocale();
}
