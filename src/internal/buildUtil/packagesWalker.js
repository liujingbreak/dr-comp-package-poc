var Path = require('path');
var fs = require('fs');
var cycle = require('cycle');
var mkdirp = require('mkdirp');
var packageBrowserInstance = require('./packageBrowserInstance');
var _ = require('lodash');
var bResolve = require('browser-resolve');
var chalk = require('chalk');
var log = require('log4js').getLogger('buildUtil.' + Path.basename(__filename, '.js'));

module.exports = walkPackages;
module.exports.saveCache = saveCache;

var config, argv, packageUtils, compileNodePath, packageInfoCacheFile;

/**
 * @return {PackageInfo}
 * @typedef PackageInfo
 * @type {Object}
 * @property {packageBrowserInstance[]} allModules
 * @property {Object.<string, packageBrowserInstance>} moduleMap key is module name
 * @property {Object.<string, packageBrowserInstance[]>} bundleMap key is bundle name
 * @property {Object.<string, packageBrowserInstance>} entryPageMap key is module name
 */
function walkPackages(_config, _argv, _packageUtils, _compileNodePath) {
	config = _config;
	argv = _argv;
	packageUtils = _packageUtils;
	compileNodePath = _compileNodePath;

	packageInfoCacheFile = Path.join(config().rootPath, config().destDir, 'packageInfo.json');
	var packageInfo;
	if ( (argv.p || argv.b) && fs.existsSync(packageInfoCacheFile)) {
		log.info('Reading build info cache from ' + packageInfoCacheFile);
		packageInfo = JSON.parse(fs.readFileSync(packageInfoCacheFile, {encoding: 'utf8'}));
		packageInfo = cycle.retrocycle(packageInfo);
	} else {
		log.info('scan for packages info');
		packageInfo = _walkPackages();
		mkdirp.sync(Path.join(config().rootPath, config().destDir));
		//saveCache(packageInfo);
	}
	return packageInfo;
}


function saveCache(packageInfo) {
	fs.writeFileSync(packageInfoCacheFile, JSON.stringify(cycle.decycle(packageInfo), null, '\t'));
}

/**
 * @return {PackageInfo}
 */
function _walkPackages() {
	var info = {
		allModules: null,
		moduleMap: {},
		bundleMap: null,
		entryPageMap: {},
		localeEntryMap: {}
	};
	var vendorConfigInfo = vendorBundleMapConfig();
	var map = info.bundleMap = vendorConfigInfo.bundleMap;
	info.allModules = vendorConfigInfo.allModules;

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
			if (config().bundlePerPackage === true && parsedName.name !== 'browserify-builder-api') {
				bundle = parsedName.name;
			} else {
				bundle = pkJson.dr.bundle || pkJson.dr.chunk;
				bundle = bundle ? bundle : parsedName.name;
			}
			if (pkJson.dr.entryPage) {
				isEntryServerTemplate = false;
				entryPages = [].concat(pkJson.dr.entryPage);
				entryPages = _.map(entryPages, path => {
					return path;
				});
				info.entryPageMap[name] = instance;
			} else if (pkJson.dr.entryView){
				isEntryServerTemplate = true;
				entryViews = [].concat(pkJson.dr.entryView);
				entryViews = _.map(entryViews, path => {
					return path;
				});
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
			file: bResolve.sync(name),
			parsedName: parsedName,
			packagePath: packagePath,
			active: pkJson.dr ? pkJson.dr.active : false,
			entryPages: entryPages,
			entryViews: entryViews,
			//isEntryJS: pkJson.dr && pkJson.dr.isEntryJS !== undefined ? (!!pkJson.dr.isEntryJS) : {}.hasOwnProperty.call(config().defaultEntrySet, name),
			browserifyNoParse: noParseFiles,
			isEntryServerTemplate: isEntryServerTemplate,
			i18n: pkJson.dr ? (pkJson.dr.i18n ? pkJson.dr.i18n : null) : null
		});
		info.allModules.push(instance);

		if (!{}.hasOwnProperty.call(map, bundle)) {
			map[bundle] = [];
		}
		map[bundle].push(instance);
	});

	info.allModules.forEach(function(instance) {
		if (!instance.longName) {
			log.debug('no long name? ' + JSON.stringify(instance, null, '\t'));
		}
		info.moduleMap[instance.longName] = instance;
	});

	return info;
}

/**
 * Read config.json, attribute 'vendorBundleMap'
 * @return {[type]} [description]
 */
function vendorBundleMapConfig() {
	var info = {
		allModules: [],
		bundleMap: null
	};
	var vendorMap = config().vendorBundleMap;
	var map = info.bundleMap = {};
	_.forOwn(vendorMap, function(moduleNames, bundle) {
		var modules = _.map(moduleNames, function(moduleName) {
			var mainFile;
			try {
				mainFile = bResolve.sync(moduleName, {paths: compileNodePath});
			} catch (err) {
				log.warn('This might be a problem:\n' +
				' browser-resolve can\'t resolve on vendor bundle package: ' + chalk.red(moduleName) +
				', remove it from ' + chalk.yellow('vendorBundleMap') + ' of config.yaml or `npm install it`');
			}
			var instance = packageBrowserInstance(config(), {
				isVendor: true,
				bundle: bundle,
				longName: moduleName,
				shortName: moduleName,
				file: mainFile
				//isEntryJS: {}.hasOwnProperty.call(config().defaultEntrySet, moduleName)
			});
			info.allModules.push(instance);
			return instance;
		});
		map[bundle] = modules;
	});
	return info;
}
