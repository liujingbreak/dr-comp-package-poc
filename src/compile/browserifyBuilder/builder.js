var _ = require('lodash');
var fs = require('fs');
var Path = require('path');
var util = require('util');
var Q = require('q');
var bResolve = require('browser-resolve');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var size = require('gulp-size');
var gulp = require('gulp');
var gulpif = require('gulp-if');
var es = require('event-stream');
var gulpFilter = require('gulp-filter');
var rename = require('gulp-rename');
var through = require('through2');
var htmlTranform = require('html-browserify');
var RevAll = require('gulp-rev-all');
var browserifyInc = require('browserify-incremental');
var xtend = require('xtend');

var log = require('@dr/logger').getLogger('browserifyBuilder.builder');
var packageBrowserInstance = require('./packageBrowserInstance');
var helperFactor = require('./browserifyHelper');

var packageUtils, config, bundleBootstrap;

module.exports = function(_packageUtils, _config, destDir) {
	packageUtils = _packageUtils;
	config = _config;
	var helper = helperFactor(config);
	//var jsTransform = helper.jsTransform;

	bundleBootstrap = helper.BrowserSideBootstrap();

	var packageInfo = walkPackages(Path.resolve(config().rootPath, config().recipeFolder, 'package.json'));
	log.debug('bundles: ' + util.inspect(_.keys(packageInfo.bundleMap)));

	// Build steps begin here
	// return depBundles(packageInfo.entryPageMap).then(function(packageDepsGraph) {
	// 	// [ Entry page package A ]--depends on--> [ package B, C ]
	// 	printModuleDependencyGraph(packageDepsGraph);
	// 	// [ Entry page package A ]--depends on--> ( bundle X, Y )
	// 	return createBundleDependencyGraph(packageDepsGraph, packageInfo.moduleMap);
	// }).then(function(_bundleDepsGraph) {
	// 	bundleDepsGraph = _bundleDepsGraph;
	log.info('------- building bundles ---------');
	var depsMap = {};
	var streams = [];
	var defEntryDeps = Q.defer();

	_.forOwn(packageInfo.bundleMap, function(modules, bundle) {
		log.info('build bundle: ' + bundle);
		streams.push(buildBundle(modules, bundle, destDir, depsMap));
	});
	var bundleStream = es.merge(streams).on('error', function(er) {
		log.error(er);
	});
	bundleStream.on('end', function() {
		// [ Entry page package A ]--depends on--> [ package B, C ]
		var depsGraph = createEntryDepsData(depsMap, packageInfo.entryPageMap);
		printModuleDependencyGraph(depsGraph);
		// [ Entry page package A ]--depends on--> ( bundle X, Y )
		var bundleDepsGraph = createBundleDependencyGraph(depsGraph, packageInfo.moduleMap);
		defEntryDeps.resolve(bundleDepsGraph);
	});

	return Q.all([defEntryDeps.promise, revisionBundle(bundleStream)])
		.then(function(resolved) {
			var bundleDepsGraph = resolved[0];
			return require('./pageCompiler')(packageInfo, bundleDepsGraph, config, destDir);
		});

	function createEntryDepsData(depsMap, entryMap) {
		//log.trace(JSON.stringify(depsMap, null, '  '));
		var packageDeps = {};
		_.forOwn(entryMap, function(pkInstance, moduleName) {
			var entryDepsSet = packageDeps[moduleName] = {};
			_walkDeps(moduleName, entryDepsSet, true);
		});

		function _walkDeps(target, entryDepsSet, isParentOurs, lastDirectDeps) {
			var deps = depsMap[target];
			_.forOwn(deps, function(module, id) {
				var ref = module ? module : id;

				if (!_.startsWith(id, '.')) {
					// require id is a module name
					var isOurs = isParentOurs && !packageUtils.is3rdParty(id);
					entryDepsSet[id] = isParentOurs ? true : lastDirectDeps;
					if (isOurs) {
						_walkDeps(ref, entryDepsSet, true);
					} else {
						_walkDeps(ref, entryDepsSet, false, id);
					}
				} else {
					// require id is a local file path
					_walkDeps(ref, entryDepsSet, isParentOurs, lastDirectDeps);
				}
			});
		}
		return packageDeps;
	}

	function createBundleDependencyGraph(packageDepsGraph, moduleMap) {
		log.info('------- Bundle dependency ---------');

		var bundleDepsGraph = {};
		_.forOwn(packageDepsGraph, function(deps, moduleName) {
			var currBundle = moduleMap[moduleName].bundle;
			var depBundleSet = {};
			bundleDepsGraph[moduleName] = depBundleSet;
			_.forOwn(deps, function(isDirectDeps, dep) {
				//log.debug('Is dep '+ dep +' our package ? ' + isVendor);
				var bundle, msg;
				if (!moduleMap[dep] || !(bundle = moduleMap[dep].bundle) ) {
					if (isDirectDeps === true) {
						msg = 'Entry bundle "' + currBundle + '", module "' + dep + '" which is dependency of bundle "' +
							currBundle + '" has not be explicityly configured with any bundle';
						log.error(msg);
						throw new Error(msg);
					} else {
						msg = 'Entry bundle "' + currBundle + '", module "' + dep + '" which is dependency of "' +
							isDirectDeps + '" has not be explicityly configured with any bundle';
						log.warn(msg);
						return;
					}
				}
				depBundleSet[bundle] = true;
			});
			depBundleSet[currBundle] = true;
		});

		_.forOwn(bundleDepsGraph, function(depBundleSet, entryModule) {
			log.info(entryModule);
			var size = _.size(depBundleSet);
			var i = 1;
			_.forOwn(depBundleSet, function(v, bundle) {
				if (i === size) {
					log.info('\t└─ ' + bundle);
				} else {
					log.info('\t├─ ' + bundle);
				}
				i++;
			});
		});

		return bundleDepsGraph;
	}

	function printModuleDependencyGraph(packageDeps) {
		log.info('------- Package dependency ----------');
		_.forOwn(packageDeps, function(deps, moduleName) {
			log.info(moduleName);

			var size = _.size(deps);
			var i = 1;
			_.forOwn(deps, function(file, dep) {
				if (i === size) {
					log.info('\t└─ ' + dep);
				} else {
					log.info('\t├─ ' + dep);
				}
				i++;
			});
		});
	}
	/**
	 *
	 * @param  {string} packageJsonFile path of package.json
	 * @return {PackageInfo}
	 */
	function walkPackages(packageJsonFile) {
		/**
		 * @typedef PackageInfo
		 * @type {Object}
		 * @property {packageModuleInstance[]} allModules
		 * @property {Object.<string, packageModuleInstance>} moduleMap key is module name
		 * @property {Object.<string, packageModuleInstance[]>} bundleMap key is bundle name
		 * @property {Object.<string, packageModuleInstance[]>} entryPageMap key is module name
		 */
		var info = {
			allModules: null,
			moduleMap: {},
			bundleMap: null,
			entryPageMap: {}
		};
		var recipePackageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf-8'));
		if (!recipePackageJson.dependencies) {
			return {};
		}
		var vendorConfigInfo = vendorBundleMapConfig();
		var map = info.bundleMap = vendorConfigInfo.bundleMap;
		info.allModules = vendorConfigInfo.allModules;

		packageUtils.findBrowserPackageByType(['core', null], function(
			name, entryPath, parsedName, pkJson, packagePath) {
			var bundle, entryHtml;
			var isEntryServerTemplate = true;
			var instance = packageBrowserInstance(config());
			if (!pkJson.dr) {
				bundle = parsedName.name;
			} else if (!pkJson.dr.builder || pkJson.dr.builder === 'browserify') {
				bundle = pkJson.dr.bundle || pkJson.dr.chunk;
				bundle = bundle ? bundle : parsedName.name;
				if (pkJson.dr.entryPage) {
					isEntryServerTemplate = false;
					entryHtml = Path.resolve(packagePath, pkJson.dr.entryPage);
					info.entryPageMap[name] = instance;
				} else if (pkJson.dr.entryView){
					isEntryServerTemplate = true;
					entryHtml = Path.resolve(packagePath, pkJson.dr.entryView);
					info.entryPageMap[name] = instance;
				}
			} else {
				return;
			}
			instance.init({
				bundle: bundle,
				longName: name,
				file: bResolve.sync(name),
				parsedName: parsedName,
				packagePath: packagePath,
				active: pkJson.dr ? pkJson.dr.active : false,
				entryHtml: entryHtml,
				isEntryServerTemplate: isEntryServerTemplate
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
			//log.debug('instance.longName=' + instance.longName);
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
				var instance = packageBrowserInstance(config(), {
					bundle: bundle,
					longName: moduleName,
					shortName: moduleName,
					file: bResolve.sync(moduleName)
				});
				info.allModules.push(instance);
				return instance;
			});
			map[bundle] = modules;
		});
		return info;
	}

	function buildBundle(modules, bundle, destDir, depsMap) {
		var mIdx = 1;
		var moduleCount = _.size(modules);
		_.each(modules, function(moduleInfo) {
			if (mIdx === moduleCount) {
				log.info('\t└─ ' + moduleInfo.longName);
				return;
			}
			log.info('\t├─ ' + moduleInfo.longName);
			mIdx++;
		});

		var listStream = bundleBootstrap.createPackageListFile(bundle, modules);

		// var b = browserify({
		// 	debug: true
		// });
		var b = browserify(xtend(browserifyInc.args, {
			debug: true
		}));
		b.add(listStream, {file: './' + bundle + '-activate.js'});
		modules.forEach(function(module) {
			b.require(module.longName);
		});
		b.transform(htmlTranform);
		excludeModules(packageInfo.allModules, b, modules);
		browserifyInc(b, {cacheFile: Path.resolve(config().buildCacheDir, 'browserify-cache.json')});

		//TODO: algorithm here can be optmized
		function excludeModules(allModules, b, entryModules) {
			allModules.forEach(function(pkModule) {
				if (!_.includes(entryModules, pkModule.longName)) {
					b.exclude(pkModule.longName);
				}
			});
		}

		b.pipeline.get('deps').push(through.obj(function(chunk, encoding, callback) {
			depsMap[chunk.id] = chunk.deps;
			//var lm = fs.statSync(chunk.file).mtime;
			//log.trace(bundle + ' deps: ' + chunk.id + ' -> ' + JSON.stringify(chunk.deps, null, '  '));
			this.push(chunk);
			callback(null);
		}));

		b.on('file', function(file, id) {
			if (_.startsWith(id, '.')) {
				log.debug('browserify file event: ' + ' id:' + id);
			}
		});

		return b.bundle()
			.on('error', logError)
			.pipe(source('js/' + bundle + '.js'))
			.pipe(buffer())
			.pipe(gulp.dest(destDir))
			//.pipe(rev())
			.on('error', logError)
			.pipe(sourcemaps.init({
				loadMaps: true
			}))
			// Add transformation tasks to the pipeline here.
			.pipe(gulpif(!config().devMode, uglify()))
			.on('error', logError)
			.pipe(rename('js/' + bundle + '.min.js'))
			.pipe(sourcemaps.write('./'))
			.pipe(size())
			//.pipe(rev.manifest({merge: true}))
			.on('error', logError);
	}

	function revisionBundle(bundleStream) {
		var def = Q.defer();
		var revAll = new RevAll();
		var revFilter = gulpFilter('**/*.js', {restore: true});

		bundleStream.pipe(revFilter)
		.pipe(revAll.revision())
		.pipe(revFilter.restore)
		.pipe(gulp.dest(destDir))
		.pipe(revAll.manifestFile())
		.pipe(gulp.dest(destDir))
		.on('end', function() {
			log.debug('all bundles compiled');
			def.resolve(bundleStream);
		});
		return def.promise;
	}
};

function logError(er) {
	log.error(er.message, er);
}
