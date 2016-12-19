'use strict';
var Path = require('path');
var fs = require('fs');
var cycle = require('cycle');
var mkdirp = require('mkdirp');
var packageBrowserInstance = require('./packageBrowserInstance');
var _ = require('lodash');
var api = require('__api');
var bResolve = require('browser-resolve');
var chalk = require('chalk');
var log = require('log4js').getLogger('buildUtil.' + Path.basename(__filename, '.js'));

module.exports = walkPackages;
module.exports.saveCache = saveCache;
module.exports.listBundleInfo = listBundleInfo;

var config, argv, packageUtils, packageInfoCacheFile;

/**
 * @return {PackageInfo}
 * @typedef PackageInfo
 * @type {Object}
 * @property {packageBrowserInstance[]} allModules
 * @property {Object.<string, packageBrowserInstance>} moduleMap key is module name
 * @property {Object.<string, packageBrowserInstance[]>} bundleMap key is bundle name
 * @property {Object.<string, packageBrowserInstance>} entryPageMap key is module name
 */
function walkPackages(_config, _argv, _packageUtils, _compileNodePath, ignoreCache) {
	config = _config;
	argv = _argv;
	packageUtils = _packageUtils;

	packageInfoCacheFile = config.resolve('destDir', 'packageInfo.json');
	var packageInfo;
	if (!ignoreCache && (argv.p || argv.b) && fs.existsSync(packageInfoCacheFile)) {
		log.info('Reading build info cache from ' + packageInfoCacheFile);
		packageInfo = JSON.parse(fs.readFileSync(packageInfoCacheFile, {encoding: 'utf8'}));
		packageInfo = cycle.retrocycle(packageInfo);
	} else {
		log.info('scan for packages info');
		packageInfo = _walkPackages(_compileNodePath);
		mkdirp.sync(Path.join(config().rootPath, config().destDir));
		//saveCache(packageInfo);
	}
	return packageInfo;
}

/**
 * `Gulp ls` command calls this function to print out browser components
 * @return {PackageInfo} packageInfo
 */
function listBundleInfo(_config, _argv, _packageUtils, _compileNodePath) {
	_config.set('bundlePerPackage', false);
	return walkPackages(_config, _argv, _packageUtils, _compileNodePath, true);
}


function saveCache(packageInfo) {
	fs.writeFileSync(packageInfoCacheFile, JSON.stringify(cycle.decycle(packageInfo), null, '\t'));
}

/**
 * @return {PackageInfo}
 */
function _walkPackages(compileNodePath) {
	var configBundleInfo = readBundleMapConfig(compileNodePath);
	var info = {
		allModules: null, // array
		moduleMap: _.clone(configBundleInfo.moduleMap),
		noBundlePackageMap: {},
		bundleMap: configBundleInfo.bundleMap,
		bundleUrlMap: configBundleInfo.bundleUrlMap,
		urlPackageSet: configBundleInfo.urlPackageSet,
		entryPageMap: {},
		localeEntryMap: {}
	};
	var bundleMap = info.bundleMap;

	packageUtils.findBrowserPackageByType('*', function(
		name, entryPath, parsedName, pkJson, packagePath) {
		var bundle, entryViews, entryPages;
		var isEntryServerTemplate = true;
		var noParseFiles;
		var instance = packageBrowserInstance(config());
		if (!pkJson.dr) {
			pkJson.dr = {};
			// log.error('missing "dr" property in ' + Path.join(packagePath, 'package.json'));
			// gutil.beep();
		}
		if (!pkJson.dr.builder || pkJson.dr.builder === 'browserify') {
			if (_.has(configBundleInfo.moduleMap, name)) {
				bundle = configBundleInfo.moduleMap[name].bundle;
				//delete configBundleInfo.moduleMap[name];
				log.debug('vendorBundleMap overrides bundle setting for ' + name);
			} else {
				bundle = pkJson.dr.bundle || pkJson.dr.chunk;
				if (!bundle && ( pkJson.dr.entryPage || pkJson.dr.entryView)) {
					// Entry package must belongs to a bundle
					bundle = parsedName.name;
				}
			}
			if (bundle && config().bundlePerPackage === true && parsedName.scope !== 'dr-core') {
				bundle = parsedName.name;// force bundle name to be same as package name
			}
			if (pkJson.dr.entryPage) {
				isEntryServerTemplate = false;
				entryPages = [].concat(pkJson.dr.entryPage);
				info.entryPageMap[name] = instance;
			} else if (pkJson.dr.entryView){
				isEntryServerTemplate = true;
				entryViews = [].concat(pkJson.dr.entryView);
				info.entryPageMap[name] = instance;
			}
			if (pkJson.dr.browserifyNoParse) {
				noParseFiles = [].concat(pkJson.dr.browserifyNoParse);
			}
		} else {
			return;
		}
		instance.init({
			isVendor: false,
			bundle: bundle,
			longName: name,
			file: bResolve.sync(name, {paths: api.compileNodePath}),
			parsedName: parsedName,
			packagePath: packagePath,
			realPackagePath: fs.realpathSync(packagePath),
			//active: pkJson.dr ? pkJson.dr.active : false,
			entryPages: entryPages,
			entryViews: entryViews,
			browserifyNoParse: noParseFiles,
			isEntryServerTemplate: isEntryServerTemplate,
			translatable: !_.has(pkJson, 'dr.translatable') || _.get(pkJson, 'dr.translatable'),
			dr: pkJson.dr,
			i18n: pkJson.dr ? (pkJson.dr.i18n ? pkJson.dr.i18n : null) : null
		});
		addPackageToBundle(instance, info, bundle, configBundleInfo);
		var otherEntries = _.get(pkJson.dr, 'otherEntries');
		if (otherEntries) {
			otherEntries = [].concat(otherEntries);
			for (let otherEntry of otherEntries) {
				if (otherEntry.startsWith('./'))
					otherEntry = otherEntry.substring(2);
				let pk = packageBrowserInstance(config());
				pk.init({
					isVendor: false,
					bundle: bundle,
					isOtherEntry: true, // the entry file is part of another package
					longName: name + '/' + otherEntry,
					file: bResolve.sync(name + '/' + otherEntry, {paths: api.compileNodePath}),
					parsedName: {scope: parsedName.scope, name: parsedName.name +  '/' + otherEntry},
					packagePath: packagePath,
					realPackagePath: fs.realpathSync(packagePath),
					//active: pkJson.dr ? pkJson.dr.active : false,
					// entryPages: null,
					// entryViews: null,
					browserifyNoParse: noParseFiles,
					isEntryServerTemplate: isEntryServerTemplate,
					translatable: !_.has(pkJson, 'dr.translatable') || _.get(pkJson, 'dr.translatable'),
					i18n: pkJson.dr ? (pkJson.dr.i18n ? pkJson.dr.i18n : null) : null
				});
				addPackageToBundle(pk, info, bundle, configBundleInfo);
			}
		}
	});
	_.each(bundleMap, (packageMap, bundle) => {
		bundleMap[bundle] = _.values(packageMap); // turn Object.<moduleName, packageInstance> to Array.<packageInstance>
	});
	info.allModules = _.values(info.moduleMap);

	return info;
}

function addPackageToBundle(instance, info, bundle, configBundleInfo) {
	info.moduleMap[instance.longName] = instance;
	if (!bundle && !_.get(configBundleInfo.moduleMap, [instance.longName, 'bundle'])) {
		info.noBundlePackageMap[instance.longName] = instance;
		return;
	}
	if (!_.has(info.bundleMap, bundle)) {
		info.bundleMap[bundle] = {};
	}
	if (_.has(configBundleInfo.moduleMap, instance.longName)) {
		var newBundle = _.get(configBundleInfo.moduleMap, instance.longName).bundle;
		log.info('Set vendorBundleMap setting of', instance.longName, ':', instance.bundle, '->', newBundle);
		instance.bundle = newBundle;
	}
	info.bundleMap[bundle][instance.longName] = instance;
}

/**
 * Read config.json, attribute 'vendorBundleMap'
 * @return {[type]} [description]
 */
function readBundleMapConfig(compileNodePath) {
	var info = {
		moduleMap: {},
		/** @type {Object.<bundleName, Object.<moduleName, packageInstance>>} */
		bundleMap: {},
		/** @type {Object.<bundleName, URL[]>} */
		bundleUrlMap: {},
		urlPackageSet: null
	};
	_readBundles(info, compileNodePath, config().externalBundleMap, true);
	_readBundles(info, compileNodePath, config().vendorBundleMap, false);
	return info;
}

function _readBundles(info, compileNodePath, mapConfig, isExternal) {
	var bmap = info.bundleMap;
	var mmap = info.moduleMap;
	if (isExternal)
		info.urlPackageSet = {};
	_.forOwn(mapConfig, function(bundleData, bundle) {
		var moduleNames = _.isArray(bundleData.modules) ? bundleData.modules : bundleData;
		var modules = {};
		_.each(moduleNames, function(moduleName) {
			var mainFile;
			try {
				mainFile = isExternal ? null : bResolve.sync(moduleName, {paths: compileNodePath});
				var instance = packageBrowserInstance(config(), {
					isVendor: true,
					bundle: bundle,
					longName: moduleName,
					shortName: packageUtils.parseName(moduleName).name,
					file: mainFile
				});
				mmap[moduleName] = instance;
				modules[moduleName] = instance;
				info.urlPackageSet[moduleName] = 1;
			} catch (err) {
				log.warn('This might be a problem:\n' +
				' browser-resolve can\'t resolve on vendor bundle package: ' + chalk.red(moduleName) +
				', remove it from ' + chalk.yellow('vendorBundleMap') + ' of config.yaml or `npm install it`');
			}
		});
		if (isExternal) {
			info.bundleUrlMap[bundle] = _.has(bundleData, 'URLs') ? bundleData.URLs : bundleData;
		} else
			bmap[bundle] = modules;
	});
}
