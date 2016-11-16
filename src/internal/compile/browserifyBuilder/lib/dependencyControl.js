var _ = require('lodash');
var Promise = require('bluebird');
var chalk = require('chalk');
var through = require('through2');
var Path = require('path');
var gutil = require('gulp-util');
var PrintNode = require('./printUtil');
var FileCache = require('@dr-core/build-util').fileCache;
var api = require('__api');
var log = require('@dr/logger').getLogger(api.packageName + '.dependencyControl');

var inited = false;
var fileCache, packageInfo;

// Input Data
var depsMap, i18nModuleNameSet, pk2localeModule, packageSplitPointMap, localeDepsMap;
var resolvedPath2Module; // resolved absolute main path -> module name
// Output Data
var packageDepsGraph; // {entries: {}, localeEntries: {}, splitPoints: {}} by createEntryPackageDepGraph()
var bundleDepsGraph; // Entry package -> depeneded bundles, by createEntryBundleDepGraph()
var splitPointDepsGraph; // Split point package -> depeneded bundles,by createEntryBundleDepGraph()
var localeBundlesDepsGraph; // by createEntryBundleDepGraph()

var nodeFileDirPattern = /^(?:\.\/|\.\.\/|\/)/; // to test if a required id is not a module name.

// functions for calculation
exports.initAsync = initAsync;
exports.browserifyDepsMap = browserifyDepsMap;
exports.updatePack2localeModule = updatePack2localeModule;
exports.addI18nModule = addI18nModule;
exports.createEntryPackageDepGraph = createEntryPackageDepGraph;
exports.createEntryBundleDepGraph = createEntryBundleDepGraph;
// functions for retrieving result of loading information
exports.entryOrSplitPointMetadata = entryOrSplitPointMetadata;
exports.cdnUrls = cdnUrls;
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
	if (!fileCache) {
		fileCache = new FileCache(_api.config().destDir);
	}
	packageInfo = _packageInfo;
	return Promise.all([
		fileCache.loadFromFile('bundleInfoCache.json'),
		fileCache.loadFromFile('depsMap.json'),
	]).then(caches => {
		depsMap = caches[1];
		initI18nBundleInfo(caches[0]);
		resolvedPath2Module = _.get(caches[0], 'resolvedPath2Module');
		if (!resolvedPath2Module)
			resolvedPath2Module = caches[0].resolvedPath2Module = {};
	});
}


/**
 * draw a cross bundles dependency map
 * @param  {object} b       browserify instance
 */
function browserifyDepsMap(b, depsMap) {
	var rootPath = api.config().rootPath;
	b.pipeline.get('deps').push(through.obj(function(row, encoding, callback) {
		var shortFilePath = row.file;
		shortFilePath = Path.isAbsolute(shortFilePath) ? Path.relative(rootPath, shortFilePath) : shortFilePath;
		var deps = _.clone(row.deps);
		_.forOwn(row.deps, function(path, id) {
			//row.deps[id] = path = fs.realpathSync(path);
			if (path && Path.isAbsolute(path)) {
				path = Path.relative(rootPath, path);
				deps[id] = path;
			}
			if (!nodeFileDirPattern.test(id)) // Meaning id is a module name
				resolvedPath2Module[path] = id;
		});
		depsMap[shortFilePath] = deps;
		callback(null, row);
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

/**
 * @Deprecated
 */
function addI18nModule(name) {
	i18nModuleNameSet[name] = 1;
}

function DepsWalker() {
	this.depPath = new UniqStringArray();
}

function UniqStringArray() {
	Array.apply(this, arguments);
	this.set = {};
}

UniqStringArray.prototype = Object.create(Array.prototype, {
	has: {
		value: function(s) {
			return _.has(this.set, s);
		}
	},
	push: {
		value: function(s) {
			this.set[s] = 1;
			Array.prototype.push.apply(this, arguments);
		}
	},

	pop: {
		value: function() {
			var last = Array.prototype.pop.apply(this, arguments);
			delete this.set[last];
		}
	}
});

/**
 * Create a map of entry module and depended modules.
 * @param  {[type]} depsMap  [description]
 * @param  {[type]} entryMap [description]
 * @return {entries: {}, localeEntries: {}, splitPoints: {}}
 */
function createEntryPackageDepGraph() {
	var walkContext = new DepsWalker();
	walkContext.walkDeps = _walkDeps;
	packageDepsGraph = {entries: {}, localeEntries: {}, splitPoints: {}};

	try {
		_.forOwn(packageInfo.entryPageMap, function(pkInstance, moduleName) {
			var entryDepsSet = packageDepsGraph.entries[moduleName] = {};
			walkContext.walkDeps(depsMap, moduleName, false, entryDepsSet, true);
			// API is always depended for entry package
			walkContext.walkDeps(depsMap, '@dr-core/browserify-builder-api', false, entryDepsSet, true);
		});
		_.forOwn(packageInfo.splitPointMap, function(pkInstance, moduleName) {
			var entryDepsSet = packageDepsGraph.splitPoints[moduleName] = {};
			walkContext.walkDeps(depsMap, moduleName, false, entryDepsSet, true);
		});
		//log.debug('packageInfo.localeEntryMap: ' + JSON.stringify(packageInfo.localeEntryMap, null, '  '));
		_.forOwn(packageInfo.localeEntryMap, (entryMap, locale) => {
			var result = packageDepsGraph.localeEntries[locale] = {};
			_.forOwn(entryMap, function(pkInstance, moduleName) {
				var entryDepsSet = result[moduleName] = {};
				walkContext.walkDeps(localeDepsMap[locale], moduleName, false, entryDepsSet, true, null, depsMap);
			});
		});
	} catch (e) {
		log.error('walked dependecy path: %s', walkContext.depPath.join('\n\t-> '));
		throw e;
	}

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
		var depPathKey = id + '(' + file + ')';
		if (this.depPath.has(depPathKey)) {
			// This dependency have already been walked, skip cycle dependency
			log.debug('cycle dependency %s in path: %s', depPathKey, this.depPath.join('\n\t-> '));
			return;
		}
		this.depPath.push(depPathKey);
		var deps;
		if (!file) { // since for external module, the `file` is always `false`
			deps = depsMap[id];
			if (parentDepsMap && !deps) {
				deps = parentDepsMap[id];
			}
		} else {
			deps = depsMap[file];
			deps = deps || depsMap[resolvedPath2Module[file]];
			if (parentDepsMap && !deps) {
				deps = parentDepsMap[file] || parentDepsMap[id];
			}
		}
		if (!deps && !_.has(i18nModuleNameSet, id) && !_.has(packageInfo.urlPackageSet, id)) {
			log.warn('id=%s', id);
			log.warn(`depsMap=${JSON.stringify(depsMap, null, '  ')}`);
			log.warn(`resolvedPath2Module=${JSON.stringify(resolvedPath2Module, null, ' ')}`);
			log.warn('i18nModuleNameSet: %s', JSON.stringify(i18nModuleNameSet, null, '  '));
			gutil.beep();
			throw new Error('Can not walk dependency tree for: ' + this.depPath.join('\n\t-> ') +
			', missing depended module or you may try rebuild all bundles');
		}
		if (!deps) {
			this.depPath.pop();
			return;
		}
		var self = this;
		_.forOwn(deps, (depsValue, depsKey) => {
			var isModuleName = !nodeFileDirPattern.test(depsKey);

			if (isModuleName) {
				// require id is a module name
				var isOurs = isParentOurs && !api.packageUtils.is3rdParty(depsKey);
				if (isOurs) {
					var currPackage = (file && _.endsWith(file, '.js')) ?
						api.findBrowserPackageByPath(file) : id;
					var foundSplitPoint = _.has(packageSplitPointMap[currPackage], depsKey);
					if (foundSplitPoint) {
						log.info('Found split point: ' + depsKey);
						entryDepsSet['sp:' + depsKey] = isParentOurs ? true : lastDirectDeps;
						entryDepsSet = packageDepsGraph.splitPoints[depsKey] = {};
					}
				}
				if (_.has(entryDepsSet, depsKey)) {
					return;
				}
				entryDepsSet[depsKey] = isParentOurs ? true : lastDirectDeps;
				if (isOurs) {
					self.walkDeps(depsMap, depsKey, depsValue, entryDepsSet,
						true, null, parentDepsMap);
				} else {
					self.walkDeps(depsMap, depsKey, depsValue, entryDepsSet, false, depsKey, parentDepsMap);
				}
			} else {
				// require id is a local file path
				self.walkDeps(depsMap, depsKey, depsValue, entryDepsSet, isParentOurs, lastDirectDeps, parentDepsMap);
			}
		});
		this.depPath.pop();
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
			var currBundle = _.get(moduleMap, [moduleName, 'bundle']);
			if (!currBundle) {
				throw new Error('No bundle setting for entry/split point ' + moduleName);
				// var parentModuleMatch = /^((?:@[^\/]+\/)?[^\/]+)/.exec(moduleName);
				// if (parentModuleMatch) { // moduleName is in form of "<package>/**/*"
				// 	currBundle = _.get(moduleMap, [parentModuleMatch[1], 'bundle']);
				// }
			}
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
				// if (_.has(i18nModuleNameSet, dep)) {
				// 	// it is i18n module like "@dr/angularjs/i18n" which is not belong to any initial bundle
				// 	api.config().locales.forEach(locale => {
				// 		var graph = locDepBundleSet[locale];
				// 		if (!graph) {
				// 			graph = locDepBundleSet[locale] = {};
				// 		}
				// 		var localeModuleName = pk2localeModule[dep][locale];
				// 		var localeDeps = packageDepsGraph.localeEntries[locale][localeModuleName];
				// 		graph[packageInfo.localeEntryMap[locale][localeModuleName].bundle] = true;
				// 		//log.debug('localeDeps: ' + JSON.stringify(localeDeps, null, '  '));
				// 		_.keys(localeDeps).forEach(moduleName => {
				// 			if (moduleMap[moduleName].bundle)
				// 				graph[moduleMap[moduleName].bundle] = true;
				// 		});
				// 	});
				// 	return;
				// } else
				if (_.startsWith(dep, 'sp:')) {
					// split point
					return;
				} else if (!moduleMap[dep] || !(bundle = moduleMap[dep].bundle)) {
					if (isDirectDeps === true) {
						msg = 'Entry bundle "' + currBundle + ' (' + moduleName + ')", module "' + dep + '" which is dependency of bundle "' +
							currBundle + '" is not explicityly configured with any bundle, it will be copyied to the dependent bundle';
						log.warn(msg);
						return;
						//throw new Error(msg);
					} else {
						msg = 'Entry bundle "' + currBundle + ' (' + moduleName + ')", module "' + dep + '" which is dependency of "' +
							isDirectDeps + '" is not explicityly configured with any bundle, , it will be copyied to the dependent bundle';
						log.debug(msg);
						return;
					}
				} else {
					log.debug(`dep: ${dep}, bundle: ${bundle}`);
				}
				if (bundle)
					depBundleSet[bundle] = true;
			});

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
			// _.forOwn(localeBundlesDepsGraph[entryOrSplitPoint], (depBundleSet, locale) => {
			// 	var subNode2 = PrintNode({content: '{locale: ' + chalk.cyan(locale) + '}', parent: subNode1});
			// 	_.forOwn(depBundleSet, function(whatever, bundle) {
			// 		PrintNode({content: chalk.magenta(bundle), parent: subNode2});
			// 	});
			// });
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
 * calculated CDN links which are depended by specific package
 * @return {js: [], css: []}
 */
function cdnUrls(packageName) {
	return {js: [], css: []};
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
