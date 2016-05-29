var _ = require('lodash');
var Promise = require('bluebird');
var chalk = require('chalk');
var through = require('through2');
var Path = require('path');
var gutil = require('gulp-util');
var PrintNode = require('./printUtil');
var FileCache = require('@dr-core/build-util').fileCache;

var inited = false;
var fileCache, api, log, packageInfo;
// Input Data
var depsMap, i18nModuleNameSet, pk2localeModule, packageSplitPointMap, localeDepsMap;
// Output Data
var packageDepsGraph; // {entries: {}, localeEntries: {}, splitPoints: {}} by createEntryPackageDepGraph()
var bundleDepsGraph; // Entry package -> depeneded bundles, by createEntryBundleDepGraph()
var splitPointDepsGraph; // Split point package -> depeneded bundles,by createEntryBundleDepGraph()
var localeBundlesDepsGraph; // by createEntryBundleDepGraph()
// functions for calculation
exports.initAsync = initAsync;
exports.browserifyDepsMap = browserifyDepsMap;
exports.updatePack2localeModule = updatePack2localeModule;
exports.addI18nModule = addI18nModule;
exports.createEntryPackageDepGraph = createEntryPackageDepGraph;
exports.createEntryBundleDepGraph = createEntryBundleDepGraph;
// functions for retrieving result of loading information
exports.entryOrSplitPointMetadata = entryOrSplitPointMetadata;
exports.noDuplicateMetadata = noDuplicateMetadata;
exports.allSplitPointsOfEntry = allSplitPointsOfEntry;

exports.tailDown = function() {
	fileCache.tailDown();
};
// properties
Object.defineProperties(exports, {
	depsMap: {
		configurable: true,
		enumerable: true,
		get: function() {
			return depsMap;
		}
	},
	localeDepsMap: {
		configurable: true,
		enumerable: true,
		get: function() {
			return localeDepsMap;
		}
	},
	packageSplitPointMap: {
		configurable: true,
		enumerable: true,
		get: function() {
			return packageSplitPointMap;
		}
	},
});

function initAsync(_api, _packageInfo) {
	if (inited) {
		return Promise.resolve();
	}
	inited = true;
	api = _api;
	if (!fileCache) {
		fileCache = new FileCache(_api.config().destDir);
	}
	log = require('@dr/logger').getLogger(api.packageName + '.dependencyControl');
	packageInfo = _packageInfo;
	return Promise.all([
		fileCache.loadFromFile('bundleInfoCache.json'),
		fileCache.loadFromFile('depsMap.json'),
	]).then(caches => {
		depsMap = caches[1];
		initI18nBundleInfo(caches[0]);
	});
}


/**
 * draw a cross bundles dependency map
 * @param  {object} b       browserify instance
 */
function browserifyDepsMap(b, depsMap) {
	var rootPath = api.config().rootPath;
	b.pipeline.get('deps').push(through.obj(function(chunk, encoding, callback) {
		var shortFilePath = Path.isAbsolute(chunk.file) ? Path.relative(rootPath, chunk.file) : chunk.file;
		var deps = _.clone(chunk.deps);
		_.forOwn(chunk.deps, function(path, id) {
			if (path && Path.isAbsolute(path)) {
				deps[id] = Path.relative(rootPath, path);
			}
		});
		depsMap[shortFilePath] = deps;
		callback(null, chunk);
	}));
}

function initI18nBundleInfo(bundleInfoCache) {
	if (!_.has(bundleInfoCache, 'i18nModuleNameSet')) {
		bundleInfoCache.i18nModuleNameSet = {};
	}
	if (!_.has(bundleInfoCache, 'localeDepsMap')) {
		bundleInfoCache.localeDepsMap = {};
	}
	// package to locale module map Object.<{string} name, Object.<{string} locale, Object>>
	if (!_.has(bundleInfoCache, 'pk2localeModule')) {
		bundleInfoCache.pk2localeModule = {};
	}
	if (!_.has(bundleInfoCache, 'splitPointMap')) {
		bundleInfoCache.splitPointMap = {};
	}
	i18nModuleNameSet = bundleInfoCache.i18nModuleNameSet;
	pk2localeModule = bundleInfoCache.pk2localeModule;
	localeDepsMap = bundleInfoCache.localeDepsMap;
	packageSplitPointMap = bundleInfoCache.splitPointMap;
}

function updatePack2localeModule(map) {
	_.assign(pk2localeModule, map);
}

function addI18nModule(name) {
	i18nModuleNameSet[name] = 1;
}
/**
 * Create a map of entry module and depended modules.
 * @param  {[type]} depsMap  [description]
 * @param  {[type]} entryMap [description]
 * @return {entries: {}, localeEntries: {}, splitPoints: {}}
 */
function createEntryPackageDepGraph() {
	packageDepsGraph = {entries: {}, localeEntries: {}, splitPoints: {}};
	_.forOwn(packageInfo.entryPageMap, function(pkInstance, moduleName) {
		var entryDepsSet = packageDepsGraph.entries[moduleName] = {};
		_walkDeps(depsMap, moduleName, false, entryDepsSet, true);
	});
	_.forOwn(packageInfo.splitPointMap, function(pkInstance, moduleName) {
		var entryDepsSet = packageDepsGraph.splitPoints[moduleName] = {};
		_walkDeps(depsMap, moduleName, false, entryDepsSet, true);
	});
	//log.debug('packageInfo.localeEntryMap: ' + JSON.stringify(packageInfo.localeEntryMap, null, '  '));
	_.forOwn(packageInfo.localeEntryMap, (entryMap, locale) => {
		var result = packageDepsGraph.localeEntries[locale] = {};
		_.forOwn(entryMap, function(pkInstance, moduleName) {
			var entryDepsSet = result[moduleName] = {};
			_walkDeps(localeDepsMap[locale], moduleName, false, entryDepsSet, true, null, depsMap);
		});
	});


	toPrintModel(packageDepsGraph.entries, '------- Entry package -> package dependency ----------',
		null, label => {
			if (_.startsWith(label, 'sp:')) {
				return '{split point} ' + label.substring('sp:'.length);
			}
			return label;
		}).print(log);
	toPrintModel(packageDepsGraph.localeEntries, '------- Locale entry package -> package dependency ----------').print(log);
	toPrintModel(packageDepsGraph.splitPoints, '------- Split Point -> package dependency ----------').print(log);
	//printEntryDepsGraph(packageDepsGraph);
	//log.debug('createEntryDepsData() packageDepsGraph = ' + JSON.stringify(packageDepsGraph, null, '  '))
	function _walkDeps(depsMap, id, file, entryDepsSet, isParentOurs, lastDirectDeps, parentDepsMap) {
		var deps;
		if (!file) { // since for external module, the `file` is always `false`
			deps = depsMap[id];
			if (parentDepsMap && !deps) {
				deps = parentDepsMap[id];
			}
		} else {
			deps = depsMap[file];
			deps = deps ? deps : depsMap[id];
			if (parentDepsMap && !deps) {
				deps = parentDepsMap[file] ? parentDepsMap[file] : parentDepsMap[id];
			}
		}
		if (!deps && !_.has(i18nModuleNameSet, id)) {
			log.error('Can not walk dependency tree for: ' + id +
			', missing depended module or you may try rebuild all bundles');
			log.info(parentDepsMap[id]);
			log.info('i18nModuleNameSet: ' + JSON.stringify(i18nModuleNameSet, null, '  '));
			gutil.beep();
		}
		if (!deps) {
			return;
		}
		_.forOwn(deps, function(depsValue, depsKey) {
			var isRelativePath = _.startsWith(depsKey, '.');

			if (!isRelativePath) {
				// require id is a module name
				var isOurs = isParentOurs && !api.packageUtils.is3rdParty(depsKey);
				if (isOurs) {
					var currPackage = (file && _.endsWith(file, '.js')) ?
						api.findBrowserPackageByPath(file) : id;
					var foundSplitPoint = _.has(packageSplitPointMap[currPackage], depsKey);
					if (foundSplitPoint) {
						log.info('Found pplit point: ' + depsKey);
						entryDepsSet['sp:' + depsKey] = isParentOurs ? true : lastDirectDeps;
						entryDepsSet = packageDepsGraph.splitPoints[depsKey] = {};
					}
				}
				if (_.has(entryDepsSet, depsKey)) {
					return;
				}
				entryDepsSet[depsKey] = isParentOurs ? true : lastDirectDeps;
				if (isOurs) {
					_walkDeps(depsMap, depsKey, depsValue, entryDepsSet,
						true, null, parentDepsMap);
				} else {
					_walkDeps(depsMap, depsKey, depsValue, entryDepsSet, false, depsKey, parentDepsMap);
				}
			} else {
				// require id is a local file path
				_walkDeps(depsMap, depsKey, depsValue, entryDepsSet, isParentOurs, lastDirectDeps, parentDepsMap);
			}
		});
	}

	function toPrintModel(value, label, parent, modifier) {
		if (modifier) {
			label = modifier(label);
		}
		var node = new PrintNode({content: label, parent: parent});
		if (!_.isObject(value)) {
			return;
		}
		_.forOwn(value, function(value1, key1) {
			toPrintModel(value1, key1, node, modifier);
		});
		return node;
	}
	return packageDepsGraph;
}

/**
 * Call createEntryPackageDepGraph() prior to this function, it relies on input
 * data `packageDepsGraph` which is returned from  createEntryPackageDepGraph()
 * @return object {bundleDepsGraph, splitPointDepsGraph, localeBundlesDepsGraph: {moduleName, {locale, {bundle: boolean}}}
 */
function createEntryBundleDepGraph() {
	var moduleMap = packageInfo.moduleMap;
	localeBundlesDepsGraph = {};
	// create graph for entry packages
	bundleDepsGraph = createGraph(packageDepsGraph.entries, false);
	toPrintModel(bundleDepsGraph, 'Entry package -> bundle dependency').print(log);
	// create graph for split points (they are same as entry package)
	splitPointDepsGraph = createGraph(packageDepsGraph.splitPoints, true);
	toPrintModel(splitPointDepsGraph, 'Split Point -> bundle dependency').print(log);

	function createGraph(entries, isSplitPoint) {
		var bundleDepsGraph = {};
		_.forOwn(entries, function(deps, moduleName) {
			var currBundle = moduleMap[moduleName].bundle;
			var depBundleSet = bundleDepsGraph[moduleName] = {};
			var locDepBundleSet = localeBundlesDepsGraph[moduleName] = {};
			depBundleSet[currBundle] = true;
			_.forOwn(deps, function(isDirectDeps, dep) {
				//log.debug('Is dep '+ dep +' our package ? ' + isVendor);
				if (dep.substring(0, 1) === '_') {
					// skip some browerify internal module like `_process`
					return;
				}
				var bundle, msg;
				if (_.has(i18nModuleNameSet, dep)) {
					// it is i18n module like "@dr/angularjs/i18n" which is not belong to any initial bundle
					api.config().locales.forEach(locale => {
						var graph = locDepBundleSet[locale];
						if (!graph) {
							graph = locDepBundleSet[locale] = {};
						}
						var localeModuleName = pk2localeModule[dep][locale];
						var localeDeps = packageDepsGraph.localeEntries[locale][localeModuleName];
						graph[packageInfo.localeEntryMap[locale][localeModuleName].bundle] = true;
						//log.debug('localeDeps: ' + JSON.stringify(localeDeps, null, '  '));
						_.keys(localeDeps).forEach(moduleName => {
							graph[moduleMap[moduleName].bundle] = true;
						});
					});
					return;
				} else if (_.startsWith(dep, 'sp:')) {
					// split point
					return;
				} else if (!moduleMap[dep] || !(bundle = moduleMap[dep].bundle)) {
					if (isDirectDeps === true) {
						msg = 'Entry bundle "' + currBundle + '", module "' + dep + '" which is dependency of bundle "' +
							currBundle + '" is not explicityly configured with any bundle, check out `vendorBundleMap` in config.yaml';
						log.warn(msg);
						throw new Error(msg);
					} else {
						msg = 'Entry bundle "' + currBundle + '", module "' + dep + '" which is dependency of "' +
							isDirectDeps + '" is not explicityly configured with any bundle, check out `vendorBundleMap` in config.yaml';
						log.warn(msg);
						return;
					}
				}
				depBundleSet[bundle] = true;
			});
			if (isSplitPoint) {
				delete depBundleSet.core; // No need for duplicate core bundle
			} else {
				// Core bundle should always be depended by all entry page modules!
				depBundleSet.core = true;
			}
			_.forOwn(depBundleSet, (whatever, initialBundle) => {
				_.forOwn(locDepBundleSet, (localeBundleSet, locale) => {
					// remove any locale bundle that are duplicate with initial bundles, we don't want to load them twice in browser.
					delete localeBundleSet[initialBundle];
				});
			});
		});
		return bundleDepsGraph;
	}

	function toPrintModel(depsGraph, title) {
		var node = new PrintNode({content: '------- ' + title + ' ---------'});
		_.forOwn(depsGraph, function(depBundleSet, entryOrSplitPoint) {
			var subNode1 = PrintNode({content: chalk.inverse(entryOrSplitPoint), parent: node});
			_.forOwn(depBundleSet, function(whatever, bundle) {
				PrintNode({content: chalk.magenta(bundle), parent: subNode1});
			});
			_.forOwn(localeBundlesDepsGraph[entryOrSplitPoint], (depBundleSet, locale) => {
				var subNode2 = PrintNode({content: '{locale: ' + chalk.cyan(locale) + '}', parent: subNode1});
				_.forOwn(depBundleSet, function(whatever, bundle) {
					PrintNode({content: chalk.magenta(bundle), parent: subNode2});
				});
			});
		});
		return node;
	}

	return {
		bundleDepsGraph: bundleDepsGraph,
		splitPointDepsGraph: splitPointDepsGraph,
		localeBundlesDepsGraph: localeBundlesDepsGraph
	};
}

/**
 * Get split points recursively for an entry package,
 * split point may have it's own split points, so it must be recursively looking up
 * @param  {[type]} entryPackageName [description]
 * @return {array}                  [description]
 */
function allSplitPointsOfEntry(entryPackageName) {
	var found = [];
	_recursivelyLookupSplitPoints(entryPackageName, found);
	// log.debug('allSplitPointsOfEntry: ' + entryPackageName);
	// log.debug(found);
	return found;
}

function _recursivelyLookupSplitPoints(entryPackageName, found) {
	//log.debug(packageDepsGraph.entries[entryPackageName]);
	_.each(packageDepsGraph.entries[entryPackageName], (x, name) => {
		if (_.startsWith(name, 'sp:')) {
			var splitPoint = name.substring('sp:'.length);
			found.push(splitPoint);
			_recursivelyLookupSplitPoints(splitPoint, found);
		}
	});
}
/**
 * calculated bundles which are needed for load a entry page or split point
 * @param  {[type]} packageName [description]
 * @return {[type]}            metadata {bundles: [], locales: { lang: bundles[]}}
 */
function entryOrSplitPointMetadata(packageName) {
	var metadata = {
		bundles: null, //array
		locales: {}
	};
	var bundleSet;
	if (_.has(bundleDepsGraph, packageName)) {
		bundleSet = bundleDepsGraph[packageName];
	} else if (_.has(splitPointDepsGraph, packageName)) {
		bundleSet = splitPointDepsGraph[packageName];
	} else {
		throw new Error('Entry or split point does not exist');
	}
	metadata.bundles = _.keys(bundleSet);
	_.forOwn(localeBundlesDepsGraph[packageName], (depBundleSet, locale) => {
		metadata.locales[locale] = _.keys(depBundleSet);
	});
	return metadata;
}

/**
 * Given entry or split point A, it tries to load split point B:
 * 	A -> B
 * B 's metadata {js: {}, css: {}, locales:{}} most likely will contain duplicate
 * bundle items as A's, so it is better to delete those duplicate items.
 *
 * It will be too complicated to draw a graph from A to B to C so on and so forth.
 * So I only simply consider eliminating duplicate items from any split points B or C to
 * the single original entry A.
 *
 * TODO: entryPackageA 's metadata can be cached to improve performance
 */
function noDuplicateMetadata(splitPointB, entryPackageA) {
	var entryData = entryOrSplitPointMetadata(entryPackageA);
	var targetData = entryOrSplitPointMetadata(splitPointB);
	var noDuplicateBundles = [];
	targetData.bundles.forEach(bundle => {
		if (!_.includes(entryData.bundles, bundle)) {
			noDuplicateBundles.push(bundle);
		}
	});
	targetData.bundles = noDuplicateBundles;

	_.forOwn(targetData.locales, (bundles, locale) => {
		if (entryData.locales[locale]){
			noDuplicateBundles = [];
			bundles.forEach(bundle => {
				if (!_.includes(entryData.locales[locale], bundle)) {
					noDuplicateBundles.push(bundle);
				}
			});
			targetData.locales[locale] = noDuplicateBundles;
		}
	});
	return targetData;
}
