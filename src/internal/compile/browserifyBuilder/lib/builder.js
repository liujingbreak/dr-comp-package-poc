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
var cycle = require('cycle');
var chalk = require('chalk');

var log;
var packageBrowserInstance = require('./packageBrowserInstance');
var helperFactor = require('./browserifyHelper');
var FileCache = require('./fileCache');
var PageCompiler = require('./pageCompiler');
var readFileAsync = Promise.promisify(fs.readFile, {context: fs});

var packageUtils, config, jsBundleEntryMaker;

/**
 * JS and CSS file Build process based on browserify and parcelify
 */
module.exports = {
	compile: compile
};

function compile(api) {
	log = require('@dr/logger').getLogger(api.packageName);
	packageUtils = api.packageUtils;
	config = api.config;
	var argv = api.argv;
	var helper = helperFactor(config);
	//var jsTransform = helper.jsTransform;
	var fileCache = new FileCache(config().destDir);
	var buildCss = true;
	var buildJS = true;

	gutil.log('Usage: gulp compile [-p <package name with or without scope part> -p <package name> ...]');
	gutil.log('\tgulp compile [-b <bundle name> -b <bunle name> ...]');
	gutil.log('\tbuild all JS and CSS bundles, if parameter <bundle name> is supplied, only that specific package or bundle will be rebuilt.');

	var packageInfo = walkPackages();
	//monkey patch new API
	api.constructor.prototype.packageInfo = packageInfo;

	log.info('------- building bundles ---------');
	var depsMap = {};
	var bundleStream;
	var bundleNames = _.keys(packageInfo.bundleMap);
	var bundlesTobuild;
	if (argv.b) {
		bundlesTobuild = [].concat(argv.b);
		if (!validateBundleNames(bundleNames, bundlesTobuild)) {
			return false;
		}
		bundleNames = bundlesTobuild;
	}
	if (argv.p) {
		bundlesTobuild = packageNames2bundles([].concat(argv.p), packageInfo.moduleMap);
		if (!validateBundleNames(bundleNames, bundlesTobuild)) {
			return false;
		}
		bundleNames = bundlesTobuild;
	}
	if (bundleNames.length <= 0) {
		return Promise.resolve();
	}
	// if (argv['only-js']) {
	// 	buildCss = false;
	// }
	if (argv['only-css']) {
		buildJS = false;
	}

	var cssPromises = [];
	var jsStreams = [];
	return fileCache.loadFromFile('depsMap.json').then(function(cachedDepsMap) {
		depsMap = cachedDepsMap;
		bundleNames.forEach(function(bundle) {
			log.info(chalk.magenta(bundle));
			var buildObj = buildBundle(packageInfo.bundleMap[bundle],
				bundle, Path.join(config().staticDir), depsMap);
			cssPromises.push(buildObj.cssPromise);
			jsStreams.push(buildObj.jsStream);
		});
		return Promise.all(cssPromises);
	}).then(function(cssBundlePaths) {
		var pageCompiler = new PageCompiler();
		return new Promise(function(resolve, reject) {
			log.debug('bundles stream created');
			var outStreams;
			if (buildCss) {
				outStreams = jsStreams.concat(gulp.src(cssBundlePaths, {base: Path.resolve(config().staticDir)}));
			}
			bundleStream = es.merge(outStreams).on('error', function(er) {
				log.error(er);
			});

			var pageCompilerParam = {};
			revisionBundleFile(bundleStream)
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
					pageCompilerParam.builtBundles = bundleNames;
					this.push(pageCompilerParam);
					callback();
				}))
			.pipe(pageCompiler.compile('server'))
			.pipe(gulp.dest(Path.join(config().destDir, 'server')))
			.pipe(pageCompiler.compile('static'))
			.pipe(gulp.dest(config().staticDir))
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
		log.info('------- Entry package -> bundle dependency ---------');

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
							currBundle + '" is not explicityly configured with any bundle';
						log.error(msg);
						throw new Error(msg);
					} else {
						msg = 'Entry bundle "' + currBundle + '", module "' + dep + '" which is dependency of "' +
							isDirectDeps + '" is not explicityly configured with any bundle';
						log.warn(msg);
						return;
					}
				}
				depBundleSet[bundle] = true;
			});
			depBundleSet[currBundle] = true;
		});

		_.forOwn(bundleDepsGraph, function(depBundleSet, entryModule) {
			log.info(chalk.magenta(entryModule));
			var size = _.size(depBundleSet);
			var i = 1;
			_.forOwn(depBundleSet, function(v, bundle) {
				if (i === size) {
					log.info('\t└─ ' + chalk.magenta(bundle));
				} else {
					log.info('\t├─ ' + chalk.magenta(bundle));
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
		log.info('------- Entry package -> package dependency ----------');
		_.forOwn(packageDeps, function(deps, moduleName) {
			log.info(chalk.magenta(moduleName));

			var size = _.size(deps);
			var i = 1;
			_.forOwn(deps, function(file, dep) {
				if (i === size) {
					log.info('\t└─ ' + chalk.magenta(dep));
				} else {
					log.info('\t├─ ' + chalk.magenta(dep));
				}
				i++;
			});
			if (size === 0) {
				log.info('\t└─ <empty>');
			}
		});
	}

	function walkPackages() {
		var packageInfoCacheFile = Path.join(config().destDir, 'packageInfo.json');
		var packageInfo;
		if (!argv.b || argv.b.length === 0 || !!fs.existsSync(config().destDir) || !fs.existsSync(packageInfoCacheFile)) {
			packageInfo = _walkPackages();
			mkdirp.sync(config().destDir);
			fs.writeFile(packageInfoCacheFile, JSON.stringify(cycle.decycle(packageInfo), null, '\t'));
		} else {
			log.info('Reading build info cache from ' + packageInfoCacheFile);
			packageInfo = JSON.parse(fs.readFileSync(packageInfoCacheFile, {encoding: 'utf8'}));
			packageInfo = cycle.retrocycle(packageInfo);
		}
		return packageInfo;
	}
	/**
	 * @return {PackageInfo}
	 */
	function _walkPackages() {
		/**
		 * @typedef PackageInfo
		 * @type {Object}
		 * @property {packageBrowserInstance[]} allModules
		 * @property {Object.<string, packageBrowserInstance>} moduleMap key is module name
		 * @property {Object.<string, packageBrowserInstance[]>} bundleMap key is bundle name
		 * @property {Object.<string, packageBrowserInstance[]>} entryPageMap key is module name
		 */
		var info = {
			allModules: null,
			moduleMap: {},
			bundleMap: null,
			entryPageMap: {}
		};
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
				isEntryJS: pkJson.dr && pkJson.dr.isEntryJS !== undefined ? (!!pkJson.dr.isEntryJS) : {}.hasOwnProperty.call(config().defaultEntrySet, name),
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
					file: bResolve.sync(moduleName),
					isEntryJS: {}.hasOwnProperty.call(config().defaultEntrySet, moduleName)
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
				log.info('\t└─ ' + chalk.magenta(moduleInfo.longName));
				return;
			}
			log.info('\t├─ ' + chalk.magenta(moduleInfo.longName));
			mIdx++;
		});
		jsBundleEntryMaker = helper.JsBundleEntryMaker(bundle, modules);
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
		b.transform(jsBundleEntryMaker.jsTranformer(modules));
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
		}/*, function flush(next) {
			fileCache.mergeWithJsonCache(Path.join(config().destDir, 'depsMap.json'), depsMap)
			.then(function(newDepsMap) {
				_.assign(depsMap, newDepsMap);
				next();
			});
			next();
		}*/));

		var jsStream = b.bundle()
				.on('error', logError)
			.pipe(source('js/' + bundle + '.js'))
			.pipe(buffer())
			.pipe(gulp.dest(destDir))
			.pipe(sourcemaps.init({
				loadMaps: true
			}))
			.pipe(gulpif(!config().devMode, uglify()))
			.pipe(gulpif(!config().devMode, rename('js/' + bundle + '.min.js')))
				.pipe(sourcemaps.write('./'))
			.pipe(size({title: bundle}))
			.on('error', logError);

		return {
			cssPromise: cssPromise,
			jsStream: jsStream
		};
	}

	function revisionBundleFile(bundleStream) {
		var revAll = new RevAll();
		var revFilter = gulpFilter(['**/*.js', '**/*.map', '**/*.css'], {restore: true});
		return bundleStream
			.pipe(revFilter)
			.pipe(revAll.revision())
			.pipe(revFilter.restore)
			.pipe(gulp.dest(Path.join(config().staticDir)))
			.pipe(revAll.manifestFile())
			.pipe(through.obj(function(row, encode, next) {
				var file = Path.join(config().destDir, Path.basename(row.path));
				if (fs.existsSync(file)) {
					readFileAsync(file).then(function(data) {
						var meta = JSON.parse(row.contents.toString('utf-8'));
						var newMeta = JSON.stringify(_.assign(JSON.parse(data), meta), null, '\t');
						log.trace('merge with existing rev-manifest.json');
						row.contents = new Buffer(newMeta);
						next(null, row);
					});
				} else {
					next(null, row);
				}
			}))
			.pipe(gulp.dest(config().destDir))
			.on('error', function(err) { log.error(err);})
			.on('finish', function() {
				log.debug('all bundles revisioned');
			});
	}

	function buildCssBundle(b, bundle, destDir) { return new Promise(function(resolve, reject) {
		mkdirp.sync(Path.resolve(destDir, 'css'));
		var fileName = Path.resolve(destDir, 'css', bundle + '.css');
		var parce = parcelify(b, {
			bundles: {
				style: fileName
			},
			appTransforms: ['@dr/parcelify-module-resolver']
		});

		parce.on('done', function() {
			log.debug('CSS Bundle built: ' + fileName);
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
}

function validateBundleNames(bundleNames, bundlesTobuild) {
	if (_.intersection(bundleNames, bundlesTobuild).length < bundlesTobuild.length) {
		gutil.log('bundle ' + bundlesTobuild + ' doesn\'t exist, existing bundles are:\n\t' + bundleNames.join('\n\t'));
		return false;
	}
	return true;
}

function packageNames2bundles(packageNames, moduleMap) {
	var bundleSet = {};

	_.forEach(packageNames, function(name) {
		if (!{}.hasOwnProperty.call(moduleMap, name)) {
			if (_.startsWith(name, '@')) {
				log.warn(chalk.yellow('Browser package cannot be found: ' + name));
				return;
			} else {
				// guess the package scope name
				var guessingName;
				if (_.some(config().packageScopes, function(scope) {
					guessingName = '@' + scope + '/' + name;
					return {}.hasOwnProperty.call(moduleMap, guessingName);
				})) {
					name = guessingName;
				} else {
					log.warn(chalk.yellow('Browser package cannot be found: ' + name));
					return;
				}
			}
		}
		bundleSet[moduleMap[name].bundle] = true;
	});
	var bundles = _.keys(bundleSet);
	return bundles;
}

var bundleLog = require('@dr/logger').getLogger('browserifyBuilder.buildBundle');
function logError(er) {
	bundleLog.error(er.message, er);
}
