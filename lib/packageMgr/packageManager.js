var _ = require('lodash');
var pth = require('path');
var log = require('log4js').getLogger('lib.packageMgr.index');
var fs = require('fs');
var Q = require('q');
var putil = require('./packageUtils');
var config = require('../config');
var Package = require('./packageInstance');

var packageCache = {};
var corePackages = {};
var eventBus;

module.exports = function(NodeApi) {
	eventBus = NodeApi.prototype.eventBus;
	return {
		readPackages: readPackages,
		loadPackages: loadPackages,
		loadCorePackages: loadCorePackages,
		packages: packageCache,
		corePackages: corePackages
	};
};

function readPackages() {
	var mainPJson = require('../../package.json');

	_.forOwn(mainPJson.dependencies, function(version, moduleName) {
		var parsed = putil.parseName(moduleName);
		if (!checkPackageName(parsed, false)) {
			return;
		}
		var mainPath = putil.findNodePackagePath(moduleName);
		if (!mainPath) {
			return;
		}
		var pjson = JSON.parse(fs.readFileSync(pth.join(
			mainPath, 'package.json'),
			'utf-8'));
		if (!pjson.main) {
			return;
		}
		log.debug('loading ' + parsed.name + ' from ' + mainPath + ' main: ' + pjson.main);
		var pk = new Package({
			moduleName: parsed.name,
			scope: parsed.scope,
			path: mainPath,
			exports: require(moduleName),
		});
		if (parsed.scope === 'dr-core') {
			corePackages[parsed.name] = pk;
		} else {
			packageCache[parsed.name] = pk;
		}
	});
	eventBus.emit('loadEnd', packageCache);
	return Q.resolve();
}

function loadCorePackages(NodeApi) {
	var promises = [];
	_.forOwn(corePackages, function(pkInstance, key) {
		if (_.isFunction(pkInstance.exports.activate)) {
			var api = new NodeApi(key, pkInstance);
			pkInstance.api = api;
			promises.push(pkInstance.exports.activate(api));
		}
	});
	Q.all(promises).then(function() {
		NodeApi.prototype.eventBus.emit('coreActivated');
	}).catch(function(er) {
		log.error(er);
	}).done();
}

function loadPackages(NodeApi) {
	var promises = [];
	_.forOwn(packageCache, function(pkInstance, key) {
		log.debug(key);
		var api = new NodeApi(key, pkInstance);
		pkInstance.api = api;
		if (pkInstance.exports && _.isFunction(pkInstance.exports.activate)) {
			promises.push(pkInstance.exports.activate(api));
		}
	});
	Q.all(promises).then(function() {
		NodeApi.prototype.eventBus.emit('packagesActivated');
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
