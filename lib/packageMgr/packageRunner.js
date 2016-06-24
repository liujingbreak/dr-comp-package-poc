var _ = require('lodash');
var log = require('log4js').getLogger('lib.packageMgr.packageRunner');
var putil = require('./packageUtils');
var config = require('../config');
var Package = require('./packageNodeInstance');
var NodeApi = require('../nodeApi');
var Promise = require('bluebird');
var util = require('util');
var priorityHelper = require('./packagePriorityHelper');
var rj = require('../injectorFactory');

var packageCache = {};
var corePackages = {};
var eventBus;

var injector = rj(require.resolve);

eventBus = NodeApi.prototype.eventBus;
module.exports = {
	readPackages: readPackages,
	loadPackages: loadPackages,
	loadCorePackages: loadCorePackages,
	packages: packageCache,
	corePackages: corePackages,
	listPackages: listPackages
};

var apiCache = {};

function readPackages(dontLoad) {
	var packages = [];
	var packageInstances = [];
	putil.findNodePackageByType('server',
		function(moduleName, entryPath, parsedName, pjson, packagePath) {
			packages.push({
					moduleName: moduleName,
					entryPath: entryPath,
					parsedName: parsedName,
					pjson: pjson,
					packagePath: packagePath
				});
			var pk = new Package({
				moduleName: parsedName.name,
				name: moduleName,
				longName: moduleName,
				scope: parsedName.scope,
				path: packagePath,
				priority: pjson.dr ? pjson.dr.serverPriority : null
			});
			packageInstances.push(pk);
			if (!dontLoad)
				injector.fromPackage(moduleName, packagePath)
					.value('__injectorFactory', rj)
					.value('__injector', injector)
					.factory('__api', () => {
						return getApiForPackage(pk);
					});
		});
	// create API instance and inject factories
	if (!dontLoad)
		injector.readInjectFile();

	packages.forEach( (p, idx) => {
		if (!checkPackageName(p.parsedName, false)) {
			return;
		}
		log.debug('  loading ' + p.parsedName.name + ' from ' + p.packagePath + ' main: ' + p.pjson.main);

		if (p.pjson.dr && _.includes([].concat(p.pjson.dr.type), 'core')) {
			corePackages[p.parsedName.name] = packageInstances[idx];
		} else {
			packageCache[p.parsedName.name] = packageInstances[idx];
		}
		if (!dontLoad)
			packageInstances[idx].exports = require(p.moduleName);
	});
	eventBus.emit('loadEnd', packageCache);
}

function loadCorePackages(NodeApi) {
	return _loadPackages(corePackages, NodeApi, 'coreActivated');
}

function _loadPackages(packages, NodeApi, eventName) {
	return priorityHelper.orderPackages(_.values(packages), pkInstance => {
		if (pkInstance.exports && _.isFunction(pkInstance.exports.activate)) {
			log.debug('active ' + pkInstance.longName);
			var api = getApiForPackage(pkInstance);
			return pkInstance.exports.activate(api, Object.getPrototypeOf(api));
		}
		return Promise.resolve();
	}).then(function() {
		NodeApi.prototype.eventBus.emit(eventName, packages);
	}).catch(function(er) {
		log.error(er);
	});
}

/**
 * Console list package in order of running priority
 * @return Array<Object<{pk: {package}, desc: {string}}>>
 */
function listPackages() {
	readPackages(true);
	var idx = 0;
	var list = [];
	var coreList = _.values(corePackages);
	var normalList = _.values(packageCache);
	var packages = _.values(coreList).concat(normalList);
	var maxNameLe = _.maxBy(packages, pk => pk.longName.length).longName.length;

	return Promise.coroutine(function*() {
		yield priorityHelper.orderPackages(coreList, pk => {
			idx++;
			var gapLen = maxNameLe - pk.longName.length;
			var gap = new Array(gapLen);
			_.fill(gap, ' ');
			list.push({
				pk: pk,
				desc: util.format('%d. %s %s[core]\tactivate priority: %s',
					idx, pk.longName, gap.join(''), pk.priority),
			});
		});
		yield priorityHelper.orderPackages(normalList, pk => {
			idx++;
			var gapLen = maxNameLe - pk.longName.length;
			var gap = new Array(gapLen);
			_.fill(gap, ' ');
			list.push({
				pk: pk,
				desc: util.format('%d. %s %s      \tactivate priority: %s',
					idx, pk.longName, gap.join(''), pk.priority),
			});
		});
		return list;
	})();
}

function loadPackages(NodeApi) {
	return _loadPackages(packageCache, NodeApi, 'packagesActivated');
}

function getApiForPackage(pkInstance) {
	if (_.has(apiCache, pkInstance.longName)) {
		return apiCache[pkInstance.longName];
	}
	var api = new NodeApi(pkInstance.longName, pkInstance);
	api.constructor = NodeApi;
	pkInstance.api = api;
	apiCache[pkInstance.longName] = api;
	return api;
}

function checkPackageName(parsedPackageName, unknownScopeWarn) {
	if (!_.includes(config().packageScopes, parsedPackageName.scope)) {
		if (unknownScopeWarn) {
			log.warn('Skip node module of unknown scope: ' + parsedPackageName.name);
		}
		return false;
	}
	//log.debug('', new Error())
	if (_.has(packageCache, parsedPackageName.name) ||
		_.has(corePackages, parsedPackageName.name)) {
		log.debug(parsedPackageName.name + ' has already been loaded');
		return false;
	}
	return true;
}
