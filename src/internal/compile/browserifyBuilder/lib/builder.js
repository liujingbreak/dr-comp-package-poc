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
var yamlify = require('yamlify');
var RevAll = require('gulp-rev-all');
var PrintNode = require('./printUtil');
var File = require('vinyl');
// var browserifyInc = require('browserify-incremental');
// var xtend = require('xtend');
var parcelify = require('parcelify');
var mkdirp = require('mkdirp');
var gutil = require('gulp-util');
var chalk = require('chalk');

var log;
var helperFactor = require('./browserifyHelper');
var FileCache = require('@dr-core/build-util').fileCache;
var PageCompiler = require('./pageCompiler');
var walkPackages = require('@dr-core/build-util').walkPackages;
var packageBrowserInstance = require('@dr-core/build-util').packageInstance;
var readFileAsync = Promise.promisify(fs.readFile, {context: fs});
var fileAccessAsync = Promise.promisify(fs.access, {context: fs});
var packageUtils, config, jsBundleEntryMaker;

var tasks = [];
var fileCache;
/**
 * JS and CSS file Build process based on browserify and parcelify
 */
module.exports = {
	compile: compile,
	addTransform:
	/**
	 * Add transform to browserify builder's pipe stream
	 * @param {transform} | {transform[]} transforms
	 */
	function(transforms) {

	}
};

function compile(api) {
	log = require('@dr/logger').getLogger(api.packageName);
	packageUtils = api.packageUtils;
	config = api.config;
	var argv = api.argv;
	var helper = helperFactor(config);
	//var jsTransform = helper.jsTransform;
	fileCache = fileCache ? fileCache : new FileCache(config().destDir);
	var buildCss = true;
	var buildJS = true;

	gutil.log('Usage: gulp compile [-p <package name with or without scope part> -p <package name> ...]');
	gutil.log('\tgulp compile [-b <bundle name> -b <bunle name> ...]');
	gutil.log('\tbuild all JS and CSS bundles, if parameter <bundle name> is supplied, only that specific package or bundle will be rebuilt.');

	var packageInfo = walkPackages(config, argv, packageUtils, api.compileNodePath);
	var i18nModuleNameSet, pk2localeModule;
	//monkey patch new API
	api.__proto__.packageInfo = packageInfo;
	require('./compilerApi')(api);

	var depsMap = {};
	var localeDepsMap;
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
		bundlesTobuild = api.packageNames2bundles([].concat(argv.p));
		if (!validateBundleNames(bundleNames, bundlesTobuild)) {
			return false;
		}
		bundleNames = bundlesTobuild;
	}
	if (bundleNames.length <= 0) {
		return Promise.resolve();
	}
	if (argv['only-js']) {
		buildCss = false;
	}
	if (argv['only-css']) {
		buildJS = false;
	}

	// extra data returned from task, which will be injected to entry page.
	// e.g. i18n information.

	var cssPromises = [];
	var jsStreams = [];
	var staticDir = Path.resolve(config().staticDir);
	var cssStream = new through.obj(function(path, enc, next) {
		fileAccessAsync(path, fs.R_OK).then(()=> {
			return readFileAsync(path, 'utf8');
		})
		.then((data) => {
			var file = new File({
				// gulp-rev-all is too stupid that it can only accept same `base` for all files,
				// So css files' base path must be sames as JS files.
				// To make rev-all think they are all based on process.cwd(), I have to change a
				// css file's path to a relative 'fake' location as as JS files.
				// Otherwise rev-manifest.json will be screwed up.
				path: Path.resolve(Path.relative(staticDir, path)),
				contents: new Buffer(data)
			});
			this.push(file);
		})
		.catch((err)=>{}).finally(()=> next());
	});
	return Promise.all([
		fileCache.loadFromFile('bundleInfoCache.json'),
		fileCache.loadFromFile('depsMap.json')
	])
	.then(function(results) {
		depsMap = results[1];
		var bundleInfoCache = results[0];
		if (!bundleInfoCache.i18nModuleNameSet) {
			bundleInfoCache.i18nModuleNameSet = {};
		}
		if (!bundleInfoCache.depsMap) {
			bundleInfoCache.depsMap = {};
		}
		// package to locale module map Object.<{string} name, Object.<{string} locale, Object>>
		if (!bundleInfoCache.pk2localeModule) {
			bundleInfoCache.pk2localeModule = {};
		}
		i18nModuleNameSet = bundleInfoCache.i18nModuleNameSet;
		pk2localeModule = bundleInfoCache.pk2localeModule;
		localeDepsMap = bundleInfoCache.depsMap;

		log.info('------- building bundles ---------');
		bundleNames.forEach(function(bundle) {
			log.info(chalk.inverse(bundle));
			var buildObj = buildBundle(packageInfo.bundleMap[bundle],
				bundle, config().staticDir, depsMap);
			if (buildCss) {
				buildObj.cssPromises.forEach(prom => {
					cssPromises.push(prom.then(filePath => {
						cssStream.write(filePath);
						return null;
					}));
				});
			}
			jsStreams.push(buildObj.jsStream);
		});
		var pageCompiler = new PageCompiler();
		var outStreams = jsStreams;
		if (buildCss) {
			outStreams.push(cssStream);
			Promise.all(cssPromises).then(()=> {
				cssStream.end();
			});
		}
		bundleStream = es.merge(outStreams)
		.on('error', function(er) {
			log.error('merged bundle stream error', er);
			gutil.beep();
		});

		var pageCompilerParam = {};
		return new Promise(function(resolve, reject) {
			revisionBundleFile(bundleStream)
			.pipe(
				through.obj(function transform(file, encoding, cb) {
					var revisionMeta = JSON.parse(file.contents.toString('utf-8'));
					pageCompilerParam.revisionMeta = revisionMeta;
					log.debug(revisionMeta);
					cb();
				}, function flush(callback) {
					// [ Entry page package A ]--depends on--> [ package B, C ]
					var depsGraph = createEntryDepsData(depsMap, packageInfo);
					printModuleDependencyGraph(depsGraph);
					// [ Entry page package A ]--depends on--> ( bundle X, Y )
					var bundleGraph = createBundleDependencyGraph(depsGraph, packageInfo);
					_.assign(pageCompilerParam, {
						config: config,
						bundleDepsGraph: bundleGraph.bundleDepsGraph,
						packageInfo: packageInfo,
						builtBundles: bundleNames
					});
					this.push(pageCompilerParam);
					api.__proto__.bundleDepsGraph = bundleGraph.bundleDepsGraph;
					api.__proto__.localeBundlesDepsGraph = bundleGraph.localeBundlesDepsGraph;
					runTasks().then(getDataFuncs => {
						pageCompilerParam.entryDataProvider = function(entryPackageName) {
							var browserApi = {};
							monkeyPatchBrowserApi(browserApi, entryPackageName, pageCompilerParam.revisionMeta);
							getDataFuncs.forEach(getData => {
								getData(browserApi, entryPackageName);
							});
							return browserApi;
						};
						callback();
					});
				}))
			.pipe(pageCompiler.compile('server'))
			.pipe(gulp.dest(Path.join(config().destDir, 'server')))
			.pipe(pageCompiler.compile('static'))
			.pipe(gulp.dest(config().staticDir))
			.on('finish', resolve);
		});
	}).then(() => {
		walkPackages.saveCache(packageInfo);
		fileCache.tailDown();
	})
	.catch( err => {
		log.error(err);
		gutil.beep();
		process.exit(1);
	});

	/**
	 * create a map of entry module and depended modules
	 * @param  {[type]} depsMap  [description]
	 * @param  {[type]} entryMap [description]
	 * @return {object<string, object<string, (boolean | string)>>} a map
	 */
	function createEntryDepsData(depsMap, packageInfo) {
		//log.debug('createEntryDepsData() ' + JSON.stringify(depsMap, null, '  '));
		var packageDeps = {entries: {}, localeEntries: {}};
		_.forOwn(packageInfo.entryPageMap, function(pkInstance, moduleName) {
			var entryDepsSet = packageDeps.entries[moduleName] = {};
			_walkDeps(depsMap, moduleName, moduleName, entryDepsSet, true);
		});
		//log.debug('packageInfo.localeEntryMap: ' + JSON.stringify(packageInfo.localeEntryMap, null, '  '));
		_.forOwn(packageInfo.localeEntryMap, (entryMap, locale) => {
			var result = packageDeps.localeEntries[locale] = {};
			_.forOwn(entryMap, function(pkInstance, moduleName) {
				var entryDepsSet = result[moduleName] = {};
				_walkDeps(localeDepsMap[locale], moduleName, moduleName, entryDepsSet, true, null, depsMap);
			});
		});
		//log.debug('createEntryDepsData() packageDeps = ' + JSON.stringify(packageDeps, null, '  '))
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
			if (!deps && !{}.hasOwnProperty.call(i18nModuleNameSet, id)) {
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
					var isOurs = isParentOurs && !packageUtils.is3rdParty(depsKey);
					if ({}.hasOwnProperty.call(entryDepsSet, depsKey)) {
						return;
					}
					entryDepsSet[depsKey] = isParentOurs ? true : lastDirectDeps;
					if (isOurs) {
						_walkDeps(depsMap, depsKey, depsValue, entryDepsSet, true, null, parentDepsMap);
					} else {
						_walkDeps(depsMap, depsKey, depsValue, entryDepsSet, false, depsKey, parentDepsMap);
					}
				} else {
					// require id is a local file path
					_walkDeps(depsMap, depsKey, depsValue, entryDepsSet, isParentOurs, lastDirectDeps, parentDepsMap);
				}
			});
		}
		return packageDeps;
	}

	/**
	 * @return object {bundleDepsGraph, localeBundlesDepsGraph: {moduleName, {locale, {bundle: boolean}}}
	 */
	function createBundleDependencyGraph(packageDepsGraph, packageInfo) {
		var moduleMap = packageInfo.moduleMap;
		var localeBundlesDepsGraph = {};
		var bundleDepsGraph = createGraph(packageDepsGraph.entries);
		printNode(toPrintModel());

		function createGraph(entries) {
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
					if ({}.hasOwnProperty.call(i18nModuleNameSet, dep)) {
						// it is i18n module like "@dr/angularjs/i18n" which is not belong to any initial bundle
						config().locales.forEach(locale => {
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
					}
					if (!moduleMap[dep] || !(bundle = moduleMap[dep].bundle)) {
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
				// Core bundle should always be depended by all entry page modules!
				depBundleSet.core = true;
				_.forOwn(depBundleSet, (whatever, initialBundle) => {
					_.forOwn(locDepBundleSet, (localeBundleSet, locale) => {
						// remove any locale bundle that are duplicate with initial bundles, we don't want to load them twice in browser.
						delete localeBundleSet[initialBundle];
					});
				});
			});
			return bundleDepsGraph;
		}

		function toPrintModel() {
			var node = new PrintNode({content: '------- Entry package -> bundle dependency ---------'});
			_.forOwn(bundleDepsGraph, function(depBundleSet, entryModule) {
				var subNode1 = PrintNode({content: chalk.inverse(entryModule), parent: node});
				_.forOwn(depBundleSet, function(whatever, bundle) {
					PrintNode({content: chalk.magenta(bundle), parent: subNode1});
				});
				_.forOwn(localeBundlesDepsGraph[entryModule], (depBundleSet, locale) => {
					var subNode2 = PrintNode({content: '{locale: ' + chalk.cyan(locale) + '}', parent: subNode1});
					_.forOwn(depBundleSet, function(whatever, bundle) {
						PrintNode({content: chalk.magenta(bundle), parent: subNode2});
					});
				});
			});
			return node;
		}

		function printNode(node) {
			log.info(node.prefix() + node.content);
			_.each(node.children, child => {
				printNode(child);
			});
		}
		return {
			bundleDepsGraph: bundleDepsGraph,
			localeBundlesDepsGraph: localeBundlesDepsGraph
		};
	}

	function printModuleDependencyGraph(packageDeps) {
		log.info('------- Entry package -> package dependency ----------');
		print(packageDeps.entries);

		_.forOwn(packageDeps.localeEntries, (entries, locale) => {
			log.info('------- locale package {' + locale + '} -> package dependency ----------');
			var nameMap = {};
			_.forOwn(pk2localeModule, (locales, name) => {
				nameMap[locales[locale]] = name;
			});
			print(entries, nameMap);
		});

		function print(entries, moduleNameMap) {
			var end = _.size(entries);
			var entryIdx = 0;
			_.forOwn(entries, function(deps, moduleName) {
				entryIdx++;
				var leading = entryIdx < end ? '├' : '└';
				var leadingChr = entryIdx < end ? '|' : ' ';
				log.info(leading + '─┬ ' + chalk.green(moduleNameMap ? moduleNameMap[moduleName] : moduleName));
				var size = _.size(deps);
				var row = 1;
				_.forOwn(deps, function(file, dep) {
					if (row === size) {
						log.info(leadingChr + ' └─── ' + chalk.cyan(dep));
					} else {
						log.info(leadingChr + ' ├─── ' + chalk.cyan(dep));
					}
					row++;
				});
				if (size === 0) {
					log.info(leadingChr + ' └─── <empty>');
				}
			});
		}
	}

	function buildBundle(modules, bundle, destDir, depsMap) {
		var browserifyOpt = {
			debug: true,
			paths: api.compileNodePath,
			basedir: process.cwd(),
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
				log.info(' └─── ' + chalk.magenta(moduleInfo.longName));
				return;
			}
			log.info(' ├─── ' + chalk.magenta(moduleInfo.longName));
			mIdx++;
		});
		var entryJsDir = Path.join(config().destDir, 'temp');
		jsBundleEntryMaker = helper.JsBundleEntryMaker(api, bundle, modules );
		var listFile = jsBundleEntryMaker.createPackageListFile();
		mkdirp.sync(entryJsDir);
		var entryFile = Path.join(entryJsDir, jsBundleEntryMaker.bundleFileName);

		fs.writeFileSync(entryFile, listFile);



		var b = browserify(browserifyOpt);
		// I commented out this block because Parcelify doesn't seems to work with browserify-incremental properly.
		// var b = browserify(xtend(browserifyInc.args, {
		// 	debug: true
		// }));
		//b.add(listStream, {file: entryFile, basedir: process.cwd});
		b.add(entryFile);
		b.require(modules.map(module => { return module.longName; }));
		b.transform(htmlTranform, {global: true});
		b.transform(yamlify, {global: true});
		b.transform(jsBundleEntryMaker.jsTranformer(modules), {global: true});

		var excludeList = excludeModules(packageInfo.allModules, b, _.map(modules, function(module) {return module.longName;}));
		excludeI18nModules(packageInfo.allModules, b);
		//browserifyInc(b, {cacheFile: Path.resolve(config().destDir, 'browserify-cache.json')});

		var cssPromises = [buildCssBundle(b, bundle, destDir)];

		// draw a cross bundles dependency map
		browserifyDepsMap(b, depsMap);
		var jsStream = _createBrowserifyBundle(b, bundle);

		var i18nBuildRet = buildI18nBundles(browserifyOpt, modules, excludeList, bundle, entryJsDir, depsMap);
		if (i18nBuildRet) {
			jsStream = es.merge([jsStream, i18nBuildRet[0]]);
			cssPromises = cssPromises.concat(i18nBuildRet[1]);
		}
		return {
			cssPromises: cssPromises,
			jsStream: jsStream
		};
	}

	function buildI18nBundles(browserifyOpt, modules, excludeList, bundle, entryJsDir, depsMap) {
		var streams = [];
		var cssPromises = [];
		var maker = helper.JsBundleWithI18nMaker(api, bundle, modules, resolve);

		config().locales.forEach(locale => {
			localeDepsMap[locale] = localeDepsMap[locale] ? localeDepsMap[locale] : {};
			var ret = buildLocaleBundle(maker, browserifyOpt, locale, modules, excludeList, bundle, entryJsDir, localeDepsMap[locale]);
			if (ret) {
				streams.push(ret[0]);
				cssPromises.push(ret[1]);
			}
		});
		if (streams.length === 0) {
			return null;
		}
		return [es.merge(streams), cssPromises];
	}

	function buildLocaleBundle(maker, browserifyOpt, locale, modules, excludeList, bundle, entryJsDir, depsMap) {
		var listFile = maker.createI18nListFile(locale);
		if (!listFile) {
			return null;
		}

		_.assign(pk2localeModule, maker.pk2LocaleModule);

		var localeBunleName = bundle + '_' + locale;

		var b = browserify(browserifyOpt);
		maker.i18nModuleForRequire.forEach(expose => {
			b.require(expose.file, expose.opts);
			var localeModuleName = expose.id;
			var pkInstance = packageBrowserInstance(config(), {
				isVendor: false,
				bundle: localeBunleName,
				longName: expose.opts.expose + '{' + locale + '}',
				shortName: expose.opts.expose + '{' + locale + '}',
				file: expose.file
				//isEntryJS: {}.hasOwnProperty.call(config().defaultEntrySet, moduleName)
			});
			if (!packageInfo.localeEntryMap[locale]) {
				packageInfo.localeEntryMap[locale] = {};
			}
			packageInfo.localeEntryMap[locale][localeModuleName] = pkInstance;
			packageInfo.moduleMap[expose.opts.expose + '{' + locale + '}'] = pkInstance;
			//log.debug('buildLocaleBundle() locale entry ' + localeModuleName);
			i18nModuleNameSet[expose.opts.expose] = 1;
		});
		//var listFilePath = Path.resolve(maker.i18nBundleEntryFileName(locale));
		// var listStream = through();
		// listStream.write(listFile, 'utf8');
		// listStream.end();
		// b.add(listStream, {file: listFilePath, basedir: process.cwd});
		var listFilePath = Path.join(entryJsDir, maker.i18nBundleEntryFileName(locale));
		fs.writeFileSync(listFilePath, listFile);
		b.add(listFilePath);
		b.transform(htmlTranform, {global: true});
		b.transform(yamlify, {global: true});
		b.transform(jsBundleEntryMaker.jsTranformer(modules), {global: true});
		browserifyDepsMap(b, depsMap);
		var cssProm = buildCssBundle(b, bundle + '_' + locale, config().staticDir);
		excludeList.forEach(b.exclude, b);
		var out = _createBrowserifyBundle(b, localeBunleName);
		return [out, cssProm];
	}

	function monkeyPatchBrowserApi(browserApi, entryPackage, revisionMeta) {
		var localeBundleSet = api.localeBundlesDepsGraph[entryPackage];
		var apiBundleLocaleMap = browserApi.localeBundlesMap = {};
		config().locales.forEach(locale => {
			var localBundles = _.keys(localeBundleSet[locale]);
			apiBundleLocaleMap[locale] = {};
			apiBundleLocaleMap[locale].js = localBundles.map(bundleName => {
				var file = 'js/' + bundleName + (config().devMode ? '' : '.min') + '.js';
				return revisionMeta[file];
			});
			localBundles.forEach(bundleName => {
				var file = 'css/' + bundleName + (config().devMode ? '' : '.min') + '.css';
				var destFile = revisionMeta[file];
				if (destFile) {
					if (!apiBundleLocaleMap[locale].css) {
						apiBundleLocaleMap[locale].css = [];
					}
					apiBundleLocaleMap[locale].css.push(destFile);
				}
			});
		});

		browserApi._config = {
			staticAssetsURL: config().staticAssetsURL,
			serverURL: config().serverURL,
			packageContextPathMapping: config().packageContextPathMapping,
			locales: config().locales
		};
	}

	/**
	 * draw a cross bundles dependency map
	 * @param  {object} b       browserify instance
	 */
	function browserifyDepsMap(b, depsMap) {
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
		}));
	}

	function excludeModules(allModules, b, entryModules) {
		var excludeList = [];
		allModules.forEach(function(pkModule) {
			if (!_.includes(entryModules, pkModule.longName)) {
				b.exclude(pkModule.longName);
				excludeList.push(pkModule.longName);
			}
		});
		return excludeList;
	}

	function excludeI18nModules(allModules, b) {
		allModules.forEach((pkModule) => {
			b.exclude(pkModule.longName + '/i18n');
		});
	}

	function revisionBundleFile(bundleStream) {
		var revAll = new RevAll();

		var stream;
		if (config().devMode) {
			var fakeRevManifest = {};
			stream = bundleStream
			.pipe(gulp.dest(config().staticDir))
			.pipe(through.obj(function(row, encode, next) {
				var relivePath = Path.relative(row.base, row.path).replace(/\\/g, '/');
				fakeRevManifest[relivePath] = relivePath;
				if (!_.endsWith(row.path, '.css')) {
					this.push(row);
				}
				next();
			}, function(next) {
				var emptyFile = new File({
					path: Path.resolve('rev-manifest.json'),
					contents: new Buffer(JSON.stringify(fakeRevManifest, null, '\t'))
				});
				this.push(emptyFile);
				next();
			}))
			.pipe(gulpFilter(['rev-manifest.json']));
		} else {
			var revFilter = gulpFilter(['**/*.js', '**/*.map', '**/*.css'], {restore: true});
			stream = bundleStream
			.pipe(revFilter)
			.pipe(through.obj(function(row, en, next) {
				this.push(row);
				next();
			}))
			.pipe(revAll.revision())
			.pipe(revFilter.restore)
			.pipe(gulp.dest(config().staticDir))
			.pipe(revAll.manifestFile());
		}
		return stream.pipe(through.obj(function(row, encode, next) {
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
		.on('error', function(err) {
			log.error('revision bundle error', err);
			gutil.beep();
		})
		.on('finish', function() {
			log.debug('all bundles revisioned');
		});
	}

	function buildCssBundle(b, bundle, destDir) {
		mkdirp.sync(Path.resolve(destDir, 'css'));
		var fileName = Path.resolve(destDir, 'css', bundle + '.css');
		var parce = parcelify(b, {
			bundles: {
				style: fileName
			},
			appTransforms: ['@dr/parcelify-module-resolver']
		});
		return new Promise(function(resolve, reject) {
			parce.on('done', function() {
				log.debug('buildCssBundle(): ' + fileName);
				resolve(fileName);
			});

			parce.on('error', function(err) {
				log.error('parcelify bundle error: ', err);
				gutil.beep();
				reject(fileName);
			});
			// this is a work around for a bug introduced in Parcelify
			// check this out, https://github.com/rotundasoftware/parcelify/issues/30
			b.pipeline.get('dedupe').push( through.obj( function( row, enc, next ) {
				if (fs.existsSync(row.file)) {
					if (fs.lstatSync(row.file).isDirectory()) {
						// most likely it is an i18n folder
						row.file = resolve(row.file);
					}
				} else {
					// row.file is a package name
					var resolved = packageInfo.moduleMap[row.id] ? packageInfo.moduleMap[row.id].file : null;
					row.file = resolved ? resolved : resolve(row.file);
				}
				this.push(row);
				next();
			}));
		});
	}

	function resolve(file) {
		return bResolve.sync(file, {paths: api.compileNodePath});
	}

	function runTasks() {
		var reses = [];
		while (tasks.length > 0) {
			var taskRes = tasks.shift()();
			reses.push(taskRes);
		}
		return Promise.all(reses);
	}
}

function _createBrowserifyBundle(b, bundle) {
	var bundleBasename = 'js/' + bundle;
	var out = b.bundle()
		.on('error', (er) => {
			log.error('browserify bundle() for bundle "' + bundle + '" failed', er);
			gutil.beep();
			out.end();
		})
		.pipe(source(bundleBasename + '.js'))
		.pipe(buffer())
		.pipe(sourcemaps.init({
			loadMaps: true
		}))
		.pipe(gulpif(!config().devMode, uglify()))
		.pipe(gulpif(!config().devMode, rename(bundleBasename + '.min.js')))
		.pipe(sourcemaps.write('./'))
		.pipe(size({title: bundleBasename}))
		.on('error', (er) => {
			log.error('browserify bundle() sourcemaps failed', er);
			out.end();
		});
	return out;
}

function validateBundleNames(bundleNames, bundlesTobuild) {
	if (_.intersection(bundleNames, bundlesTobuild).length < bundlesTobuild.length) {
		gutil.log('bundle ' + bundlesTobuild + ' doesn\'t exist, existing bundles are:\n\t' + bundleNames.join('\n\t'));
		return false;
	}
	return true;
}
