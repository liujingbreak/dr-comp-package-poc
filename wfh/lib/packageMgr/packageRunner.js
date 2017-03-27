var _ = require('lodash');
var log = require('log4js').getLogger('packageRunner');
var config = require('../config');
var NodeApi = require('../nodeApi');
var Promise = require('bluebird');
var util = require('util');
var helper = require('./packageRunnerHelper');
var priorityHelper = require('./packagePriorityHelper');

var packageCache = {};
var corePackages = {};
var eventBus;

eventBus = NodeApi.prototype.eventBus;
module.exports = {
	runServer: runServer,
	runBuilder: runBuilder,
	requireServerPackages: requireServerPackages,
	activateNormalComponents: activateNormalComponents,
	activateCoreComponents: activateCoreComponents,
	packages: packageCache,
	corePackages: corePackages,
	listServerComponents: listServerComponents,
	listBuilderComponents: listBuilderComponents
};

function runServer(argv) {
	var packagesTypeMap = requireServerPackages();

	NodeApi.prototype.argv = argv;
	NodeApi.prototype.runBuilder = function(buildArgv, excludeNames) {
		_.assign(buildArgv, argv);
		if (!Array.isArray(excludeNames))
			excludeNames = [excludeNames];
		var builders = _.filter(packagesTypeMap.builder, packageIns => !_.includes(excludeNames, packageIns.longName) );

		return helper.runBuilderComponents(builders, buildArgv);
	};
	return activateCoreComponents()
	.then(() => {
		return activateNormalComponents();
	});
}

function runBuilder(argv) {
	var packagesTypeMap = helper.traversePackages(true);
	return helper.runBuilderComponents(packagesTypeMap.builder, argv)
	.then(buildRes => helper.sendlivereload(buildRes, argv));
}

function requireServerPackages(dontLoad) {
	var packagesTypeMap = helper.traversePackages(!dontLoad);
	// var proto = NodeApi.prototype;
	// proto.argv = argv;

	// create API instance and inject factories

	_.each(packagesTypeMap.server, (p, idx) => {
		if (!checkPackageName(p.scope, p.shortName, false)) {
			return;
		}
		if (_.includes([].concat(_.get(p, 'json.dr.type')), 'core')) {
			corePackages[p.shortName] = p;
		} else {
			packageCache[p.shortName] = p;
		}
		if (!dontLoad)
			p.exports = require(p.moduleName);
	});
	eventBus.emit('loadEnd', packageCache);
	return packagesTypeMap;
}

function activateCoreComponents() {
	return _activePackages(corePackages, 'coreActivated');
}

function activateNormalComponents() {
	return _activePackages(packageCache, 'packagesActivated');
}

function _activePackages(packages, eventName) {
	return priorityHelper.orderPackages(_.values(packages), pkInstance => {
		return helper.runServerComponent(pkInstance);
	}, 'json.dr.serverPriority')
	.then(function() {
		NodeApi.prototype.eventBus.emit(eventName, packages);
	});
}

/**
 * Console list package in order of running priority
 * @return Array<Object<{pk: {package}, desc: {string}}>>
 */
function listServerComponents() {
	requireServerPackages(true);
	var idx = 0;

	var coreList = _.values(corePackages);
	var normalList = _.values(packageCache);
	var packages = _.values(coreList).concat(normalList);
	var maxNameLe = _.maxBy(packages, pk => pk.longName.length).longName.length;

	return Promise.coroutine(function*() {
		var list = [];
		yield priorityHelper.orderPackages(coreList, pk => {
			idx++;
			var gapLen = maxNameLe - pk.longName.length;
			var gap = new Array(gapLen);
			_.fill(gap, ' ');
			list.push({
				pk: pk,
				desc: util.format('%d. %s %s[core] priority: %s',
					idx, pk.longName, gap.join(''), _.get(pk, 'json.dr.serverPriority')),
			});
		}, 'json.dr.serverPriority');
		yield priorityHelper.orderPackages(normalList, pk => {
			idx++;
			var gapLen = maxNameLe - pk.longName.length;
			var gap = new Array(gapLen);
			_.fill(gap, ' ');
			list.push({
				pk: pk,
				desc: util.format('%d. %s %s       priority: %s',
					idx, pk.longName, gap.join(''), _.get(pk, 'json.dr.serverPriority')),
			});
		}, 'json.dr.serverPriority');
		return list;
	})();
}

function listBuilderComponents() {
	var util = require('util');
	var packages = helper.traversePackages(false).builder;
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
				desc: util.format('%d. %s %s priority: %s', idx, pk.longName, gap.join(''), _.get(pk, 'json.dr.builderPriority')),
			});
		}, 'json.dr.builderPriority');
		return list;
	})();
}

function checkPackageName(scope, shortName, unknownScopeWarn) {
	if (!_.includes(config().packageScopes, scope)) {
		if (unknownScopeWarn) {
			log.warn('Skip node module of unknown scope: ' + shortName);
		}
		return false;
	}
	//log.debug('', new Error())
	if (_.has(packageCache, shortName) ||
		_.has(corePackages, shortName)) {
		log.debug(shortName + ' has already been loaded');
		return false;
	}
	return true;
}
