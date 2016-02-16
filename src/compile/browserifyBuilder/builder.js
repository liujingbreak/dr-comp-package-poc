/* global -Promise */
var _ = require('lodash');
var Promise = require('bluebird');
var fs = require('fs');
var Path = require('path');
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
// var browserifyInc = require('browserify-incremental');
// var xtend = require('xtend');
var parcelify = require('parcelify');
var mkdirp = require('mkdirp');
var gutil = require('gulp-util');

var log = require('@dr/logger').getLogger('browserifyBuilder.builder');
var packageBrowserInstance = require('./packageBrowserInstance');
var helperFactor = require('./browserifyHelper');
var FileCache = require('./fileCache');
var readFileAsync = Promise.promisify(fs.readFile, {context: fs});

var packageUtils, config, jsBundleEntryMaker;

/**
 * JS and CSS file Build process based on browserify and parcelify
 * @param  {packageUtils} _packageUtils [description]
 * @param  {config} _config       [description]
 * @param  {yargs.argv} argv       command line arguments encapuslated by `yargs`
 * @return {Promise}               [description]
 */
module.exports = function(_packageUtils, _config, argv) {
	packageUtils = _packageUtils;
	config = _config;
	var helper = helperFactor(config);
	//var jsTransform = helper.jsTransform;
	var fileCache = new FileCache(config().destDir);

	gutil.log('Usage: gulp compile [-b <bundle name> -b <bunle name> ...]');
	gutil.log('\tbuild all JS and CSS bundles, if parameter <bundle name> is supplied, only that specific bundle will be rebuilt.');

	var packageInfo = walkPackages(Path.resolve(config().rootPath, config().recipeFolder, 'package.json'));
	log.info('------- building bundles ---------');
	var depsMap = {};
	var proms = [];
	var bundleStream;
	var bundleNames = _.keys(packageInfo.bundleMap);
	if (argv.b) {
		var bundlesTobuild = [].concat(argv.b);
		if (_.intersection(bundleNames, bundlesTobuild).length < bundlesTobuild.length) {
			gutil.log('bundle ' + bundlesTobuild + ' doesn\'t exist, existing bundles are:\n\t' + bundleNames.join('\n\t'));
			return;
		}
		bundleNames = bundlesTobuild;
	}

	bundleNames.forEach(function(bundle) {
		log.info('build bundle: ' + bundle);
		var prom = buildBundle(packageInfo.bundleMap[bundle],
			bundle, Path.join(config().destDir, 'static'), depsMap);
		proms.push(prom);
	});

	return Promise.all(proms)
	.then(function(resolveds) { return new Promise(function(resolve, reject) {
			log.debug('bundles stream created');

			var cssBundlePaths = _.map(resolveds, function(resolved) {
				return resolved[1];
			});
			log.debug('css bundles: ' + cssBundlePaths);

			bundleStream = es.merge(_.map(resolveds, function(resolved) {
				return resolved[0];
			}).concat(gulp.src(cssBundlePaths, {base: Path.resolve('dist/static')})))
			.on('error', function(er) {
				log.error(er);
			});
			var pageCompilerParam = {};
			revisionJsBundle(bundleStream)
			.pipe(
				through.obj(function transform(file, encoding, cb) {
					var revisionMeta = JSON.parse(file.contents.toString('utf-8'));
					pageCompilerParam.revisionMeta = revisionMeta;
					cb();
				}, function flush(callback) {
					// [ Entry page package A ]--depends on--> [ package B, C ]
					var depsGraph = createEntryDepsData(depsMap, packageInfo.entryPageMap);
					printModuleDependencyGraph(depsGraph);
					// [ Entry page package A ]--depends on--> ( bundle X, Y )
					var bundleDepsGraph = createBundleDependencyGraph(depsGraph, packageInfo.moduleMap);
					pageCompilerParam.bundleDepsGraph = bundleDepsGraph;
					pageCompilerParam.config = config;
					pageCompilerParam.packageInfo = packageInfo;
					this.push(pageCompilerParam);
					callback();
				}))
			.pipe(require('./pageCompiler').stream())
			.pipe(gulp.dest(config().destDir))
			.on('finish', resolve);
		});
	}).then(_.bind(fileCache.tailDown, fileCache));

	/**
	 * create a map of entry module and depended modules
	 * @param  {[type]} depsMap  [description]
	 * @param  {[type]} entryMap [description]
	 * @return {object<string, object<string, (boolean | string)>>} a map
	 */
	function createEntryDepsData(depsMap, entryMap) {
		//log.trace('createEntryDepsData: ' + JSON.stringify(depsMap, null, '  '));
		var packageDeps = {};
		_.forOwn(entryMap, function(pkInstance, moduleName) {
			var entryDepsSet = packageDeps[moduleName] = {};
			_walkDeps(moduleName, moduleName, entryDepsSet, true);
		});

		function _walkDeps(id, file, entryDepsSet, isParentOurs, lastDirectDeps) {
			var deps;
			if (!file) { // since for external module, the `file` is always `false`
				deps = depsMap[id];
			} else {
				deps = depsMap[file];
				deps = deps ? deps : depsMap[id];
			}
			if (!deps) {
				log.error('Can not walk dependency tree for: ' + id +
				', missing depended module or you may try rebuild all bundles');
			}
			_.forOwn(deps, function(depsValue, depsKey) {
				var isRelativePath = _.startsWith(depsKey, '.');

				if (!isRelativePath) {
					// require id is a module name
					var isOurs = isParentOurs && !packageUtils.is3rdParty(depsKey);
					if ({}.hasOwnProperty.call(entryDepsSet, depsKey)) {
						return;
					}
					entryDepsSet[depsKey] = isParentOurs ? true : lastDirectDeps;
					if (isOurs) {
						_walkDeps(depsKey, depsValue, entryDepsSet, true);
					} else {
						_walkDeps(depsKey, depsValue, entryDepsSet, false, depsKey);
					}
				} else {
					// require id is a local file path
					_walkDeps(depsKey, depsValue, entryDepsSet, isParentOurs, lastDirectDeps);
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
				if (dep.substring(0, 1) === '_') {
					// skip some browerify internal module like `_process`
					return;
				}
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
			if (size === 0) {
				log.info('\t└─ <empty>');
			}
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
			if (size === 0) {
				log.info('\t└─ <empty>');
			}
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
			var noParseFiles;
			var instance = packageBrowserInstance(config());
			if (!pkJson.dr) {
				bundle = parsedName.name;
			} else if (!pkJson.dr.builder || pkJson.dr.builder === 'browserify') {
				if (config().bundlePerPackage === true && parsedName.name !== 'browserify-builder-api') {
					bundle = parsedName.name;
				} else {
					bundle = pkJson.dr.bundle || pkJson.dr.chunk;
					bundle = bundle ? bundle : parsedName.name;
				}
				if (pkJson.dr.entryPage) {
					isEntryServerTemplate = false;
					entryHtml = Path.resolve(packagePath, pkJson.dr.entryPage);
					info.entryPageMap[name] = instance;
				} else if (pkJson.dr.entryView){
					isEntryServerTemplate = true;
					entryHtml = Path.resolve(packagePath, pkJson.dr.entryView);
					info.entryPageMap[name] = instance;
				}
				if (pkJson.dr.browserifyNoParse) {
					noParseFiles = [].concat(pkJson.dr.browserifyNoParse);
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
				browserifyNoParse: noParseFiles,
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
		var browserifyOpt = {
			debug: true,
			noParse: config().browserifyNoParse ? config().browserifyNoParse : []
		};
		var mIdx = 1;
		var moduleCount = _.size(modules);
		_.each(modules, function(moduleInfo) {
			if (moduleInfo.browserifyNoParse) {
				moduleInfo.browserifyNoParse.forEach(function(noParseFile) {
					var file = Path.resolve(moduleInfo.packagePath, noParseFile);
					browserifyOpt.noParse.push(file);
				});
			}
			if (mIdx === moduleCount) {
				log.info('\t└─ ' + moduleInfo.longName);
				return;
			}
			log.info('\t├─ ' + moduleInfo.longName);
			mIdx++;
		});
		jsBundleEntryMaker = helper.JsBundleEntryMaker(bundle);
		var listFile = jsBundleEntryMaker.createPackageListFile(modules);
		mkdirp.sync(destDir);
		var entryFile = Path.join(destDir, jsBundleEntryMaker.bundleFileName);

		fs.writeFileSync(entryFile, listFile);



		var b = browserify(browserifyOpt);
		// I commented out this block because Parcelify doesn't seems to work with browserify-incremental properly.
		// var b = browserify(xtend(browserifyInc.args, {
		// 	debug: true
		// }));
		//b.add(listStream, {file: entryFile});
		b.add(Path.join(destDir, jsBundleEntryMaker.bundleFileName));

		modules.forEach(function(module) {
			b.require(module.longName);
		});
		b.transform(htmlTranform);
		b.transform(jsBundleEntryMaker.jsTranformFactory());
		excludeModules(packageInfo.allModules, b, _.map(modules, function(module) {return module.longName;}));
		//browserifyInc(b, {cacheFile: Path.resolve(config().destDir, 'browserify-cache.json')});

		//TODO: algorithm here can be optmized
		function excludeModules(allModules, b, entryModules) {
			allModules.forEach(function(pkModule) {
				if (!_.includes(entryModules, pkModule.longName)) {
					b.exclude(pkModule.longName);
				}
			});
		}

		var cssPromise = buildCssBundle(b, bundle, destDir);

		//var deps = [];
		// draw a cross bundles dependency map
		var rootPath = config().rootPath;
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
		}, function(next) {
			fileCache.mergeWithJsonCache(Path.join(config().destDir, 'depsMap.json'), depsMap)
			.then(function(newDepsMap) {
				_.assign(depsMap, newDepsMap);
				next();
			});
			next();
		}));

		// b.on('file', function(file, id) {
		// 	if (_.startsWith(id, '.')) {
		// 		log.debug('watchify file:' + id);
		// 	}
		// });
		var jsStream = b.bundle()
				.on('error', logError)
			.pipe(source('js/' + bundle + '.js'))
			.pipe(buffer())
			.pipe(gulp.dest(destDir))
			// .on('end', function() {
			// 	log.trace(bundle + '\'s deps: ' + JSON.stringify(deps, null, '  '));
			// })
			.pipe(sourcemaps.init({
				loadMaps: true
			}))
			.pipe(gulpif(!config().devMode, uglify()))
			.pipe(gulpif(!config().devMode, rename('js/' + bundle + '.min.js')))
				.pipe(sourcemaps.write('./'))
			.pipe(size({title: bundle}))
			.on('error', logError);
		return Promise.all([
			jsStream, cssPromise
		]);
	}

	function revisionJsBundle(bundleStream) {
		//var def = Q.defer();
		var revAll = new RevAll();
		var revFilter = gulpFilter(['**/*.js', '**/*.css'], {restore: true});
		return bundleStream.pipe(revFilter)
			.pipe(revAll.revision())
			.pipe(revFilter.restore)
			.pipe(gulp.dest(Path.join(config().destDir, 'static')))
			.pipe(revAll.manifestFile())
			.pipe(through.obj(function(row, encode, next) {
				var file = Path.join(config().destDir, Path.basename(row.path));
				if (fs.existsSync(file)) {
					readFileAsync(file).then(function(data) {
						log.trace('existing revision rev-manifest.json:\n' + data);
						var meta = JSON.parse(row.contents.toString('utf-8'));
						var newMeta = JSON.stringify(_.assign(JSON.parse(data), meta), null, '\t');
						log.trace('merge with existing rev-manifest.json:\n' + newMeta);
						row.contents = new Buffer(newMeta);
						next(null, row);
					});
				} else {
					next(null, row);
				}
			}))
			.pipe(gulp.dest(config().destDir))
			.on('finish', function() {
				log.debug('all JS bundles revisioned');
			});
	}

	function buildCssBundle(b, bundle, destDir) { return new Promise(function(resolve, reject) {
		mkdirp.sync(Path.resolve(destDir, 'css'));
		var fileName = Path.resolve(destDir, 'css', bundle + '.css');
		var parce = parcelify(b, {
			bundles: {
				style: fileName
			},
			appTransforms: ['less-css-stream']
		});

		parce.on('done', function() {
			resolve(fileName);
		});

		parce.on('error', function(err) {
			log.error('parcelify bundle error: ', err);
			reject(fileName);
		});
		// this is a work around for a bug introduced in Parcelify
		// check this out, https://github.com/rotundasoftware/parcelify/issues/30
		b.pipeline.get('dedupe').push( through.obj( function( row, enc, next ) {
			if (!fs.existsSync(row.file)) {
				var resolved = packageInfo.moduleMap[row.id].file;
				row.file = resolved ? resolved : bResolve.sync(row.file);
			}
			this.push(row);
			next();
		}));
	});
	}
};

var bundleLog = require('@dr/logger').getLogger('browserifyBuilder.buildBundle');
function logError(er) {
	bundleLog.error(er.message, er);
}
