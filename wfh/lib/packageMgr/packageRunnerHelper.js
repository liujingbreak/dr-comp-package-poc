var packageUtils = require('./packageUtils');
var config = require('../config');
var Package = require('./packageNodeInstance');
var NodeApi = require('../nodeApi');
var priorityHelper = require('./packagePriorityHelper');
var _ = require('lodash');
var log = require('log4js').getLogger('wfh.packageMgr.packageRunnerHelper');
var rj = require('../injectorFactory');
var Promise = require('bluebird');
var http = require('http');
var fs = require('fs');
var nodeInjector = rj(require.resolve);

exports.sendlivereload = sendlivereload;
exports.runBuilderComponents = runBuilderComponents;
exports.runServerComponent = runServerComponent;
exports.runBuilderComponent = runBuilderComponent;
exports.traversePackages = traversePackages;
exports.getApiForPackage = getApiForPackage;

var apiCache = {};
NodeApi.prototype.apiForPackage = function(name) {
	return apiCache[name] || getApiForPackage(name);
};
var initialized = false;

function runBuilderComponents(builderComponents, argv, skips) {
	var proto = NodeApi.prototype;
	proto.argv = argv;
	var walkPackages = require('@dr-core/build-util').walkPackages;
	var packageInfo = walkPackages(config, argv, packageUtils, proto.compileNodePath, argv['package-cache'] === false);
	initWebInjector(packageInfo, proto);
	proto.packageInfo = packageInfo;
	return priorityHelper.orderPackages(builderComponents, pkInstance => {
		if (_.includes(skips, pkInstance.longName)) {
			log.info('skip builder: %s', pkInstance.longName);
			return;
		}
		log.info('run builder: ' + pkInstance.longName);
		return runBuilderComponent(pkInstance);
	}, 'json.dr.builderPriority')
	.then(() => walkPackages.saveCache(packageInfo));
}

function sendlivereload(buildRes, argv) {
	if (config.get('devMode') === true && config.get('livereload.enabled', true)) {
		var changedFile = argv['only-css'] ? 'yyy.css' : 'xxx.js';
		return new Promise((resolve, reject) => {
			var req = http.request({
				method: 'GET',
				hostname: 'localhost',
				port: config.get('livereload.port'),
				path: '/changed?files=' + changedFile
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
	}
	return Promise.resolve(null);
}

function runBuilderComponent(pkInstance) {
	var res;
	var api = getApiForPackage(pkInstance);
	var packageExports = require(pkInstance.longName);
	if (_.isFunction(packageExports.compile)) {
		res = packageExports.compile(api);
	} else if (_.isFunction(packageExports)){
		res = packageExports(packageUtils, config, api.argv);
	}
	if (res && _.isFunction(res.pipe)) {
		// is stream
		return new Promise((resolve, reject) => {
			res.on('end', function() {
				log.debug('builder' + pkInstance.longName + ' done');
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

function runServerComponent(pkInstance) {
	var packageExports = require(pkInstance.longName);
	if (packageExports && _.isFunction(packageExports.activate)) {
		log.info('active ' + pkInstance.longName);
		var api = getApiForPackage(pkInstance);
		return packageExports.activate(api, Object.getPrototypeOf(api));
	}
	return Promise.resolve();
}

/**
 * Initialize browser side package injector
 */
function initWebInjector(packageInfo, apiPrototype) {
	if (initialized)
		return;
	initialized = true;
	var webInjector = rj(null, true);
	_.each(packageInfo.allModules, pack => {
		if (pack.packagePath) // no vendor package's path information
			webInjector.addPackage(pack.longName, pack.packagePath);
	});
	webInjector.fromAllPackages()
	.replaceCode('__api', '__api')
	.substitute(/^([^\{]*)\{locale\}(.*)$/,
		(filePath, match) => match[1] + apiPrototype.getBuildLocale() + match[2]);

	webInjector.readInjectFile('module-resolve.browser.js');
	apiPrototype.browserInjector = webInjector;
}

/**
 * @return a hash object, key is {string} type, value is packageInstance[]
 */
function traversePackages(needInject) {
	var packagesTypeMap = mapPackagesByType(['builder', 'server'], needInject ?
		(pkInstance, name, entryPath, parsedName, pkJson, packagePath) => {
			setupNodeInjectorFor(pkInstance, name, packagePath);
		} : null);
	if (needInject)
		nodeInjector.readInjectFile();
	return packagesTypeMap;
}

function setupNodeInjectorFor(pkInstance, name, packagePath) {
	log.debug('setupNodeInjectorFor %s resolved to: %s', name, packagePath);
	nodeInjector.fromPackage(name, packagePath)
	.value('__injectorFactory', rj)
	.value('__injector', nodeInjector)
	.factory('__api', function() {
		return getApiForPackage(pkInstance);
	});
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
/**
 * mapPackagesByType
 * @param {string[]} types of "dr.type" e.g. ['server', 'builder']
 * @param {function(name, entryPath, parsedName, pkJson, packagePath)} onEachPackage
 * @return a hash object, key is {string} type, value is packageInstance[]
 */
function mapPackagesByType(types, onEachPackage) {
	var packagesMap = {};
	_.each(types, type => {
		packagesMap[type] = [];
	});

	packageUtils.findNodePackageByType('*', (name, entryPath, parsedName, pkJson, packagePath) => {
		packagePath = fs.realpathSync(packagePath);
		var pkInstance = new Package({
			moduleName: name,
			shortName: parsedName.name,
			name: name,
			longName: name,
			scope: parsedName.scope,
			path: packagePath,
			json: pkJson
		});
		_.each(types, type => {
			var drTypes = [].concat(_.get(pkJson, 'dr.type'));
			if (!_.includes(drTypes, type))
				return;
			//pkInstance.priority = _.get(pkJson, ['dr', type + 'Priority']);
			packagesMap[type].push(pkInstance);
		});
		if (onEachPackage) {
			onEachPackage(pkInstance, name, entryPath, parsedName, pkJson, packagePath);
		}
	});
	return packagesMap;
}
