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
var File = require('vinyl');

var parcelify = require('parcelify');
var mkdirp = require('mkdirp');
var gutil = require('gulp-util');
var chalk = require('chalk');
var api = require('__api');
var log = require('@dr/logger').getLogger(api.packageName + '.builder');
var helperFactor = require('./browserifyHelper');
var PageCompiler = require('./pageCompiler');
var walkPackages = require('@dr-core/build-util').walkPackages;
var depCtl = require('./dependencyControl');
var packageBrowserInstance = require('@dr-core/build-util').packageInstance;
var rj = require('__injectorFactory');
var readFileAsync = Promise.promisify(fs.readFile, {context: fs});
var fileAccessAsync = Promise.promisify(fs.access, {context: fs});
var packageUtils, config, jsBundleEntryMaker, injector;

var tasks = [];
var addonTransforms = [];
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
		addonTransforms = addonTransforms.concat(transforms);
	}
};

/**
 * Initialize browser side package injector
 */
function initInjector(packageInfo) {
	if (injector)
		return;
	injector = rj(null, true);
	_.each(packageInfo.allModules, pack => {
		if (pack.packagePath) // no vendor package's path information
			injector.addPackage(pack.longName, pack.packagePath);
	});
	injector.fromAllPackages().value('__api', {replacement: '__api'});
	injector.readInjectFile('browserify-inject.js');
}

function compile() {
	gutil.log('Usage: gulp compile [-p <package name with or without scope part> -p <package name> ...]');
	gutil.log('\tgulp compile [-b <bundle name> -b <bunle name> ...]');
	gutil.log('\tbuild all JS and CSS bundles, if parameter <bundle name> is supplied, only that specific package or bundle will be rebuilt.');

	packageUtils = api.packageUtils;
	config = api.config;
	var argv = api.argv;
	//var jsTransform = helper.jsTransform;
	var buildCss = true;
	var buildJS = true;
	var cssPromises = [];
	var jsStreams = [];
	var staticDir = Path.resolve(config().staticDir);
	var packageInfo = walkPackages(config, argv, packageUtils, api.compileNodePath);
	initInjector(packageInfo);
	var helper = helperFactor(config, injector);
	//monkey patch new API
	Object.getPrototypeOf(api).packageInfo = packageInfo;
	require('./compilerApi')(api);

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

	var cssStream = through.obj(function(path, enc, next) {
		fileAccessAsync(path, fs.R_OK).then(()=> {
			return readFileAsync(path, 'utf8');
		})
		.then((data) => {
			var file = new File({
				// gulp-rev-all is so stupid that it can only accept same `base` for all files,
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
	return depCtl.initAsync(api, packageInfo)
		.then(buildStart)
		.then(() => {
			walkPackages.saveCache(packageInfo);
			return depCtl.tailDown();
		})
		.catch( err => {
			log.error(err);
			gutil.beep();
			process.exit(1);
		});

	function buildStart() {
		log.info('------- building bundles ---------');
		bundleNames.forEach(function(bundle) {
			log.info(chalk.inverse(bundle));
			var buildObj = buildBundle(packageInfo.bundleMap[bundle],
				bundle, config().staticDir);
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
		var pageCompiler = new PageCompiler(addonTransforms);
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
					// {entries: {}, localeEntries: {}, splitPoints: {}}
					var depsGraph = depCtl.createEntryPackageDepGraph();
					// [ Entry page package A ]--depends on--> ( bundle X, Y )
					var bundleGraph = depCtl.createEntryBundleDepGraph();
					_.assign(pageCompilerParam, {
						config: config,
						bundleDepsGraph: bundleGraph.bundleDepsGraph,
						packageInfo: packageInfo,
						builtBundles: bundleNames
					});
					this.push(pageCompilerParam);
					_.assign(Object.getPrototypeOf(api), {
						packageDepsGraph: depsGraph,
						bundleDepsGraph: bundleGraph.bundleDepsGraph,
						localeBundlesDepsGraph: bundleGraph.localeBundlesDepsGraph,
						splitPointDepsGraph: bundleGraph.splitPointDepsGraph
					});
					pageCompilerParam.getBundleMetadataForEntry = (entryPackage) => {
						return getBundleMetadataForEntry(entryPackage, pageCompilerParam.revisionMeta);
					};
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
	}



	function buildBundle(modules, bundle, destDir) {
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
		jsBundleEntryMaker = helper.JsBundleEntryMaker(api, bundle, modules, depCtl.packageSplitPointMap);
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
		addonTransforms.forEach(addonTransform => {
			b.transform(addonTransform, {global: true});
		});
		b.transform(htmlTranform, {global: true});
		b.transform(yamlify, {global: true});
		b.transform(jsBundleEntryMaker.transform('{do not require localed package here}'), {global: true});

		var excludeList = excludeModules(packageInfo.allModules, b, _.map(modules, function(module) {return module.longName;}));
		excludeI18nModules(packageInfo.allModules, b);
		//browserifyInc(b, {cacheFile: Path.resolve(config().destDir, 'browserify-cache.json')});

		var cssPromises = [buildCssBundle(b, bundle, destDir)];

		// draw a cross bundles dependency map
		depCtl.browserifyDepsMap(b, depCtl.depsMap, resolve);
		var jsStream = _createBrowserifyBundle(b, bundle);

		var i18nBuildRet = buildI18nBundles(browserifyOpt, modules, excludeList, bundle, entryJsDir);
		if (i18nBuildRet) {
			jsStream = es.merge([jsStream, i18nBuildRet[0]]);
			cssPromises = cssPromises.concat(i18nBuildRet[1]);
		}
		return {
			cssPromises: cssPromises,
			jsStream: jsStream
		};
	}

	function buildI18nBundles(browserifyOpt, modules, excludeList, bundle, entryJsDir) {
		var streams = [];
		var cssPromises = [];
		var maker = helper.JsBundleWithI18nMaker(api, bundle, modules, depCtl.packageSplitPointMap, resolve);

		config().locales.forEach(locale => {
			if (!_.has(depCtl.localeDepsMap, locale)) {
				depCtl.localeDepsMap[locale] = {};
			}
			var ret = buildLocaleBundle(maker, browserifyOpt, locale, modules, excludeList, bundle, entryJsDir, depCtl.localeDepsMap[locale]);
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
		depCtl.updatePack2localeModule(maker.pk2LocaleModule);

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
				//isEntryJS: _.has(config().defaultEntrySet, moduleName)
			});
			if (!packageInfo.localeEntryMap[locale]) {
				packageInfo.localeEntryMap[locale] = {};
			}
			packageInfo.localeEntryMap[locale][localeModuleName] = pkInstance;
			packageInfo.moduleMap[expose.opts.expose + '{' + locale + '}'] = pkInstance;
			//log.debug('buildLocaleBundle() locale entry ' + localeModuleName);
			depCtl.addI18nModule(expose.opts.expose);
		});
		//var listFilePath = Path.resolve(maker.i18nBundleEntryFileName(locale));
		// var listStream = through();
		// listStream.write(listFile, 'utf8');
		// listStream.end();
		// b.add(listStream, {file: listFilePath, basedir: process.cwd});
		var listFilePath = Path.join(entryJsDir, maker.i18nBundleEntryFileName(locale));
		fs.writeFileSync(listFilePath, listFile);
		b.add(listFilePath);
		addonTransforms.forEach(addonTransform => {
			b.transform(addonTransform, {global: true});
		});
		b.transform(htmlTranform, {global: true});
		b.transform(yamlify, {global: true});
		//jsBundleEntryMaker.setLocale(locale);
		b.transform(jsBundleEntryMaker.transform(locale), {global: true});
		depCtl.browserifyDepsMap(b, depsMap, resolve);
		var cssProm = buildCssBundle(b, bundle + '_' + locale, config().staticDir);
		excludeList.forEach(b.exclude, b);
		var out = _createBrowserifyBundle(b, localeBunleName);
		return [out, cssProm];
	}

	function monkeyPatchBrowserApi(browserApi, entryPackage, revisionMeta) {
		// setup server side config setting to browser
		browserApi._config = {
			staticAssetsURL: config().staticAssetsURL,
			serverURL: config().serverURL,
			packageContextPathMapping: config().packageContextPathMapping,
			locales: config().locales,
			devMode: config().devMode
		};
		// setup locale bundles data
		browserApi.localeBundlesMap = {};
		var entryMetadata = depCtl.entryOrSplitPointMetadata(entryPackage);
		_.each(entryMetadata.locales, (bundles, locale) => {
			browserApi.localeBundlesMap[locale] = {
				js: bundles2FilePaths(bundles, 'js', revisionMeta),
				css: bundles2FilePaths(bundles, 'css', revisionMeta)
			};
		});
		// setup split points bundles data

		depCtl.allSplitPointsOfEntry(entryPackage).forEach(splitPoint => {
			var metadata = depCtl.noDuplicateMetadata(splitPoint, entryPackage);
			var loadingFiles = {};
			// normal bundles
			loadingFiles = {
				js: bundles2FilePaths(metadata.bundles, 'js', revisionMeta),
				css: bundles2FilePaths(metadata.bundles, 'css', revisionMeta),
				locales: {}
			};
			if (_.size(loadingFiles.js) === 0) {
				delete loadingFiles.js;
			}
			if (_.size(loadingFiles.css) === 0) {
				delete loadingFiles.css;
			}

			// locale bundles
			_.each(metadata.locales, (bundles, locale) => {
				loadingFiles.locales[locale] = {
					js: bundles2FilePaths(bundles, 'js', revisionMeta),
					css: bundles2FilePaths(bundles, 'css', revisionMeta)
				};
				if (_.size(loadingFiles.locales[locale].js) === 0) {
					delete loadingFiles.locales[locale].js;
				}
				if (_.size(loadingFiles.locales[locale].css) === 0) {
					delete loadingFiles.locales[locale].css;
				}
			});
			if (!_.has(browserApi, 'splitPoints')) {
				browserApi.splitPoints = {};
			}
			browserApi.splitPoints[splitPoint] = loadingFiles;
		});
		var firstLoaded = getBundleMetadataForEntry(entryPackage, revisionMeta);

		if (_.has(browserApi, 'splitPoints')) {
			// there is no split points for this entry, no need to track loaded bundles
			browserApi.loadedBundleFileSet = {};
			firstLoaded.js.forEach(path => {
				browserApi.loadedBundleFileSet[path] = 1;
			});
			firstLoaded.css.forEach(path => {
				browserApi.loadedBundleFileSet[path] = 1;
			});
		}
	}

	function getBundleMetadataForEntry(entryPackage, revisionMeta) {
		var entryMetadata = depCtl.entryOrSplitPointMetadata(entryPackage);
		return {
			js: bundles2FilePaths(entryMetadata.bundles, 'js', revisionMeta),
			css: bundles2FilePaths(entryMetadata.bundles, 'css', revisionMeta)
		};
	}

	function bundles2FilePaths(bundles, type, revisionMeta) {
		var paths = [];
		_.each(bundles, bundle => {
			var file = type + '/' + bundle + ((config().devMode || type === 'css') ? '' : '.min') + '.' + type;
			if (_.has(revisionMeta, file)) {
				paths.push(revisionMeta[file]);
			}
		});
		return paths;
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
		var appTransforms = ['@dr/parcelify-module-resolver'];
		// addonTransforms.forEach(addonTransform => {
		// 	appTransforms.push(addonTransform);
		// });
		var parce = parcelify(b, {
			bundles: {
				style: fileName
			},
			appTransforms: appTransforms
		});
		return new Promise(function(resolve, reject) {
			parce.on('done', function() {
				//log.debug('buildCssBundle(): ' + fileName);
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
		.pipe(gulpif(config().enableSourceMaps, sourcemaps.init({
			loadMaps: true
		})))
		.pipe(gulpif(!config().devMode, uglify()))
		.pipe(gulpif(!config().devMode, rename(bundleBasename + '.min.js')))
		.pipe(gulpif(config().enableSourceMaps, sourcemaps.write('./')))
		.pipe(size({
			showFiles: true,
			gzip: true,
			showTotal: false
		}))
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
