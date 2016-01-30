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
var gutil = require('gulp-util');
var rev = require('gulp-rev');
var mdeps = require('module-deps');
// var esprima = require('esprima');
// var estraverse = require('estraverse');
var through = require('through2');

var log = require('@dr/logger').getLogger('browserifyBuilder.builder');
var packageBrowserInstance = require('./packageBrowserInstance');
var helperFactor = require('./browserifyHelper');

var packageUtils, config, jsDest, bundleBootstrap;


module.exports = function(_packageUtils, _config, destDir) {
	packageUtils = _packageUtils;
	config = _config;
	jsDest = Path.resolve(destDir, 'js');
	var helper = helperFactor(config);
	var textHtmlTranform = helper.textHtmlTranform;
	var buildinSet = helper.buildinSet;
	//var jsTransform = helper.jsTransform;

	bundleBootstrap = helper.BrowserSideBootstrap();


	var browserifyTask = [];
	var packageInfo = walkPackages(Path.resolve(config().rootPath, config().recipeFolder, 'package.json'));
	log.debug('bundles: ' + util.inspect(_.keys(packageInfo.bundleMap)));

	return depBundles(packageInfo.entryPageMap).then(function(packageDepsGraph) {
		printModuleDependencyGraph(packageDepsGraph);
		var bundleDepsGraph = createBundleDependencyGraph(packageDepsGraph, packageInfo.moduleMap);

		log.info('------- building bundles ---------');
		_.forOwn(packageInfo.bundleMap, function(modules, bundle) {
			log.info('build bundle: ' + bundle);
			var def = Q.defer();
			browserifyTask.push(def.promise);
			buildBundle(modules, bundle, jsDest)
			.on('end', function() {
				def.resolve();
			}).on('error', function(er) {
				log.info(er);
				def.reject(er);
			});
		});
	});

	function createBundleDependencyGraph(packageDepsGraph, moduleMap) {
		log.info('------- Bundle dependency ---------');

		var bundleDepsGraph = {};
		_.forOwn(packageDepsGraph, function(deps, moduleName) {
			var currBundle = moduleMap[moduleName].bundle;
			var depBundleSet = {};
			bundleDepsGraph[moduleName] = depBundleSet;
			_.forOwn(deps, function(file, dep) {
				var bundle = moduleMap[dep].bundle;
				if (!bundle) {
					var msg = 'Module "' + dep + '" which is dependency of "' +
						currBundle + '" has not be configured with any bundle';
					log.error(msg);
					throw new Error(msg);
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

	function depBundles(pkgEntryPageMap) {
		var packageDeps = {};
		var proms = [];
		_.forOwn(pkgEntryPageMap, function(pages, packageModule) {
			proms.push(new Promise(function(resolve, reject) {
					log.info('entry page: ' + pages);
					var allDeps = {};
					var md = mdeps({
						resolve: bResolve,
						filter: function(id, file, pkg) {
							return !{}.hasOwnProperty.call(buildinSet, id);
						}
					});
					md.pipe(through.obj(function(chunk, encoding, callback) {
						filterFileDeps(allDeps, chunk.deps);
						this.push(chunk);
						callback(null);
					}))
					.on('finish', function() {
						packageDeps[packageModule] = allDeps;
						resolve(allDeps);
					}).on('error', function(er) {
						reject(er);
					});
					md.end({id: packageModule});
				})
			);
		});
		return Promise.all(proms).then(function() {
			return packageDeps;
		});
	}

	function filterFileDeps(targetMap, depsMap) {
		_.forOwn(depsMap, function(file, id) {
			if (!_.startsWith(id, '.')) {
				targetMap[id] = file;
			}
		});
		return targetMap;
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
		 * @property {Object.<string, string[]>} entryPageMap key is module name, value is array of page path
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
			var bundle;
			if (!pkJson.dr) {
				bundle = parsedName.name;
			} else if (!pkJson.dr.builder || pkJson.dr.builder === 'browserify') {
				bundle = pkJson.dr.bundle || pkJson.dr.chunk;
				bundle = bundle ? bundle : parsedName.name;
				if (pkJson.dr.entryPage) {
					if (info.entryPageMap[name] == null) {
						info.entryPageMap[name] = [];
					}
					info.entryPageMap[name].push(Path.resolve(packagePath, pkJson.dr.entryPage));
				}
			} else {
				return;
			}
			var instance = packageBrowserInstance({
				bundle: bundle,
				longName: name,
				file: bResolve.sync(name),
				parsedName: parsedName,
				active: pkJson.dr ? pkJson.dr.active : false
			}, config());
			info.allModules.push(instance);

			if (!{}.hasOwnProperty.call(map, bundle)) {
				map[bundle] = [];
			}
			map[bundle].push(instance);
		});

		info.allModules.forEach(function(instance) {
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
				var instance = packageBrowserInstance({
					bundle: bundle,
					longName: moduleName,
					shortName: moduleName,
					file: bResolve.sync(moduleName)
				}, config());
				info.allModules.push(instance);
				return instance;
			});
			map[bundle] = modules;
		});
		return info;
	}

	function buildBundle(modules, bundle, jsDest) {
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

		var b = browserify({
			debug: true
		});
		b.add(listStream, {file: bundle + '-activate.js'});
		modules.forEach(function(module) {
			b.require(module.longName);
		});
		b.transform(textHtmlTranform);
		//b.transform(jsTransform);
		excludeModules(packageInfo.allModules, b, modules);

		//TODO: algorithm here can be optmized
		function excludeModules(allModules, b, entryModules) {
			allModules.forEach(function(pkModule) {
				if (!_.includes(entryModules, pkModule.longName)) {
					b.exclude(pkModule.longName);
				}
			});
		}

		return b.bundle()
			.on('error', logError)
			.pipe(source(bundle + '.js'))
			.pipe(buffer())
			// .pipe(gulp.dest('./dist/js/'))
			// .on('error', logError)
			// .pipe(rename(bundle + '.min.js'))
			// .pipe(rev())
			.on('error', logError)
			.pipe(sourcemaps.init({
				loadMaps: true
			}))
			// Add transformation tasks to the pipeline here.
			//.pipe(uglify())
			.on('error', logError)
			.pipe(sourcemaps.write('./'))
			.pipe(size())
			.pipe(gulp.dest(jsDest))
			.pipe(rev.manifest({merge: true}))
			.pipe(gulp.dest(jsDest))
			.on('error', logError);
	}

	// function calculateDependency(entryFilePath) {
	// 	log.debug('read ' + entryFilePath);
	// 	var ast = esprima.parse(fs.readFileSync(entryFilePath, 'utf-8'));
	// 	estraverse.traverse(ast, {
	// 		enter: function(node) {
	// 			if (node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier' &&
	// 				node.callee.name === 'require') {
	// 				log.debug(node.arguments[0].value);
	// 			}
	// 		}
	// 	});
	// }
	//return Q.all(browserifyTask);
};

function logError(er) {
	log.error(er.message, er);
}
