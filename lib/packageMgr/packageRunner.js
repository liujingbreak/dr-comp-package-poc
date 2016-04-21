var _ = require('lodash');
var log = require('log4js').getLogger('lib.packageMgr.packageRunner');
var putil = require('./packageUtils');
var config = require('../config');
var Package = require('./packageNodeInstance');
var NodeApi = require('../nodeApi');
var Promise = require('bluebird');
var priorityHelper = require('./packagePriorityHelper');

var packageCache = {};
var corePackages = {};
var eventBus;

eventBus = NodeApi.prototype.eventBus;
module.exports = {
	readPackages: readPackages,
	loadPackages: loadPackages,
	loadCorePackages: loadCorePackages,
	packages: packageCache,
	corePackages: corePackages
};

function readPackages() {
	putil.findNodePackageByType(['core', null],
	function(moduleName, entryPath, parsedName, pjson, packagePath) {
		//var parsed = putil.parseName(moduleName);
		if (!checkPackageName(parsedName, false)) {
			return;
		}
		log.debug('  loading ' + parsedName.name + ' from ' + packagePath + ' main: ' + pjson.main);
		var pk = new Package({
			moduleName: parsedName.name,
			name: moduleName,
			longName: moduleName,
			scope: parsedName.scope,
			path: packagePath,
			priority: pjson.dr ? pjson.dr.serverPriority : null,
			exports: require(pjson.name)
		});
		if (pjson.dr && pjson.dr.type === 'core') {
			corePackages[parsedName.name] = pk;
		} else if ((!pjson.dr) || pjson.dr.type !== 'builder') {
			packageCache[parsedName.name] = pk;
		}
	});
	eventBus.emit('loadEnd', packageCache);
}

function loadCorePackages(NodeApi) {
	return _loadPackages(corePackages, NodeApi, 'coreActivated');
}

function _loadPackages(packages, NodeApi, eventName) {
	return priorityHelper.orderPackages(_.values(packages), pkInstance => {
		if (pkInstance.exports && _.isFunction(pkInstance.exports.activate)) {
			var api = new NodeApi(pkInstance.longName, pkInstance);
			api.constructor = NodeApi;
			pkInstance.api = api;
			log.debug('active ' + pkInstance.longName);
			return pkInstance.exports.activate(api, NodeApi.prototype);
		}
		return Promise.resolve();
	}).then(function() {
		NodeApi.prototype.eventBus.emit(eventName, packages);
	}).catch(function(er) {
		log.error(er);
	});
}

function loadPackages(NodeApi) {
	return _loadPackages(packageCache, NodeApi, 'packagesActivated');
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
