require('../nodeSearchPath');
var _ = require('lodash');
var log = require('log4js').getLogger('lib.packageMgr.packageRunner');
var Q = require('q');
var putil = require('./packageUtils');
var config = require('../config');
var Package = require('./packageNodeInstance');
var NodeApi = require('../nodeApi');

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
			path: packagePath
		});
		if (pjson.dr && pjson.dr.type === 'core') {
			corePackages[parsedName.name] = pk;
		} else if ((!pjson.dr) || pjson.dr.type !== 'builder') {
			packageCache[parsedName.name] = pk;
		}
	});
	eventBus.emit('loadEnd', packageCache);
	return Q.resolve();
}

function loadCorePackages(NodeApi) {
	var promises = [];
	_.forOwn(corePackages, function(pkInstance, key) {
		pkInstance.exports = require(pkInstance.longName);
		if (_.isFunction(pkInstance.exports.activate)) {
			var api = new NodeApi(pkInstance.longName, pkInstance);
			api.constructor = NodeApi;
			pkInstance.api = api;
			promises.push(pkInstance.exports.activate(api, NodeApi.prototype));
		}
	});
	Q.all(promises).then(function() {
		NodeApi.prototype.eventBus.emit('coreActivated', packageCache);
	}).catch(function(er) {
		log.error(er);
	}).done();
}

function loadPackages(NodeApi) {
	var promises = [];
	_.forOwn(packageCache, function(pkInstance, key) {
		pkInstance.exports = require(pkInstance.longName);
		var api = new NodeApi(pkInstance.longName, pkInstance);
		api.constructor = NodeApi;
		pkInstance.api = api;
		if (pkInstance.exports && _.isFunction(pkInstance.exports.activate)) {
			promises.push(pkInstance.exports.activate(api));
		}
	});
	Q.all(promises).then(function() {
		NodeApi.prototype.eventBus.emit('packagesActivated', packageCache);
	}).catch(function(er) {
		log.error(er);
	}).done();
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
