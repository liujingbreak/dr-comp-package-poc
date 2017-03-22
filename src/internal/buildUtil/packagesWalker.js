'use strict';
var Path = require('path');
var fs = require('fs');
var cycle = require('cycle');
var mkdirp = require('mkdirp');
var packageBrowserInstance = require('./packageBrowserInstance');
var _ = require('lodash');
var api = require('__api');
var bResolve = require('browser-resolve');
var resolve = require('resolve');
//var chalk = require('chalk');
var log = require('log4js').getLogger('buildUtil.' + Path.basename(__filename, '.js'));
const DirTree = require('require-injector/lib/dir-tree').DirTree;

module.exports = walkPackages;
module.exports.saveCache = saveCache;
module.exports.listBundleInfo = listBundleInfo;

var config, argv, packageUtils, packageInfoCacheFile, isFromCache;

/**
 * @return {PackageInfo}
 * @typedef PackageInfo
 * @type {Object}
 * @property {packageBrowserInstance[]} allModules
 * @property {Object.<string, packageBrowserInstance>} moduleMap key is module name
 * @property {Object.<string, packageBrowserInstance[]>} bundleMap key is bundle name
 * @property {Object.<string, packageBrowserInstance>} entryPageMap key is module name
 * @property dirTree
 * @property findPackageByFile(path): packageBrowserInstance
 */
function walkPackages(_config, _argv, _packageUtils, _compileNodePath, ignoreCache) {
	config = _config;
	argv = _argv;
	packageUtils = _packageUtils;

	packageInfoCacheFile = config.resolve('destDir', 'packageInfo.json');
	var packageInfo;
	if (!ignoreCache && (argv.p || argv.b) && fs.existsSync(packageInfoCacheFile)) {
		isFromCache = true;
		log.info('Reading build info cache from ' + packageInfoCacheFile);
		packageInfo = JSON.parse(fs.readFileSync(packageInfoCacheFile, {encoding: 'utf8'}));
		packageInfo = cycle.retrocycle(packageInfo);
	} else {
		isFromCache = false;
		log.info('scan for packages info');
		packageInfo = _walkPackages(_compileNodePath);
		mkdirp.sync(Path.join(config().rootPath, config().destDir));
		//saveCache(packageInfo);
	}
	createPackageDirTree(packageInfo);
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
		var entryViews, entryPages;
		var isEntryServerTemplate = true;
		var noParseFiles, instance;
		if (_.has(info.moduleMap, name))
			instance = info.moduleMap[name];
		else {
			// There are also node packages
			//log.warn('No chunk setting for package %s', chalk.red(name));
			instance = packageBrowserInstance(config(), {
				isVendor: true,
				bundle: null,
				longName: name,
				shortName: packageUtils.parseName(name).name,
				packagePath: packagePath,
				realPackagePath: fs.realpathSync(packagePath),
			});
		}
		if (!pkJson.dr) {
			pkJson.dr = {};
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
			noParseFiles = [].concat(pkJson.dr.browserifyNoParse || pkJson.dr.noParse);
		}
		var mainFile;
		try {
			// For package like e2etest, it could have no main file
			mainFile = bResolve.sync(name, {paths: api.compileNodePath});
		} catch (err) {}
		instance.init({
			isVendor: false,
			file: mainFile ? fs.realpathSync(mainFile) : null,
			style: pkJson.style ? resolveStyle(name) : null,
			parsedName: parsedName,
			entryPages: entryPages,
			entryViews: entryViews,
			browserifyNoParse: noParseFiles,
			isEntryServerTemplate: isEntryServerTemplate,
			translatable: !_.has(pkJson, 'dr.translatable') || _.get(pkJson, 'dr.translatable'),
			dr: pkJson.dr,
			compiler: pkJson.dr.compiler,
			i18n: pkJson.dr ? (pkJson.dr.i18n ? pkJson.dr.i18n : null) : null
		});
		info.moduleMap[instance.longName] = instance;
		if (!instance.bundle)
			info.noBundlePackageMap[instance.longName] = instance;
	});
	_.each(bundleMap, (packageMap, bundle) => {
		bundleMap[bundle] = _.values(packageMap); // turn Object.<moduleName, packageInstance> to Array.<packageInstance>
	});
	info.allModules = _.values(info.moduleMap);

	return info;
}

function resolveStyle(name) {
	return fs.realpathSync(resolve.sync(name, {
		paths: api.compileNodePath,
		packageFilter: (pkg, pkgfile) => {
			pkg.main = pkg.style;
			return pkg;
		}
	}));
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
	_readBundles(info, config().externalBundleMap, true);
	_readPackageChunkMap(info);
	return info;
}

function _readPackageChunkMap(info) {
	var bmap = info.bundleMap;
	var mmap = info.moduleMap;
	_.each(config()._package2Chunk, (bundle, moduleName) => {
		try {
			var packagePath = packageUtils.findBrowserPackagePath(moduleName);
			var parsedName = packageUtils.parseName(moduleName);
			var instance = packageBrowserInstance(config(), {
				isVendor: true,
				bundle: bundle,
				longName: moduleName,
				parsedName: parsedName,
				shortName: parsedName.name,
				packagePath: packagePath,
				realPackagePath: fs.realpathSync(packagePath)
			});
			mmap[moduleName] = instance;
			info.urlPackageSet[moduleName] = 1;
			if (_.has(bmap, bundle) && _.isArray(bmap[bundle]))
				bmap[bundle].push(instance);
			else
				bmap[bundle] = [instance];
		} catch (err) {
			log.warn(err);
			throw err;
		}
	});
}

function _readBundles(info, mapConfig, isExternal) {
	var bmap = info.bundleMap;
	var mmap = info.moduleMap;
	if (isExternal)
		info.urlPackageSet = {};
	_.forOwn(mapConfig, function(bundleData, bundle) {
		var moduleNames = _.isArray(bundleData.modules) ? bundleData.modules : bundleData;
		var bundleModules = _.map(moduleNames, function(moduleName) {
			try {
				var packagePath = packageUtils.findBrowserPackagePath(moduleName);
				var instance = packageBrowserInstance(config(), {
					isVendor: true,
					bundle: bundle,
					longName: moduleName,
					shortName: packageUtils.parseName(moduleName).name,
					packagePath: packagePath,
					realPackagePath: fs.realpathSync(packagePath)
				});
				mmap[moduleName] = instance;
				info.urlPackageSet[moduleName] = 1;
				return instance;
			} catch (err) {
				log.warn(err);
				throw err;
			}
		});
		if (isExternal) {
			if (_.isArray(bundleData))
				info.bundleUrlMap[bundle] = bundleData;
			else if (_.has(bundleData, 'URLs'))
				info.bundleUrlMap[bundle] = bundleData.URLs;
			else if (_.isObject(bundleData)) {
				info.bundleUrlMap[bundle] = bundleData; // bundleData.css, bundleData.js
				if (!_.has(bundleData, 'js') && !_.has(bundleData, 'css'))
					throw new Error('config property "externalBundleMap" must be array of object {css: string[], js: string[]}');
			} else {
				info.bundleUrlMap[bundle] = [bundleData];
			}
		} else
			bmap[bundle] = bundleModules;
	});
}

function createPackageDirTree(packageInfo) {
	var tree = new DirTree();
	packageInfo.allModules.forEach(moduleInstance => {
		if (moduleInstance.realPackagePath)
			tree.putData(moduleInstance.realPackagePath, moduleInstance);
		if (moduleInstance.packagePath !== moduleInstance.realPackagePath)
			tree.putData(moduleInstance.packagePath, moduleInstance);
	});
	packageInfo.dirTree = tree;
	Object.getPrototypeOf(api).findPackageByFile = function(file) {
		return tree.getAllData(file).pop();
	};
}
