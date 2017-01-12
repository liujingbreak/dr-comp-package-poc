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
//var sourcemaps = require('gulp-sourcemaps');
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
var esParser = require('./esParser');
//var packageBrowserInstance = require('@dr-core/build-util').packageInstance;
var rj = require('__injectorFactory');
var readFileAsync = Promise.promisify(fs.readFile, {context: fs});
var fileAccessAsync = Promise.promisify(fs.access, {context: fs});
var packageUtils, config, injector;

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
		transforms = [].concat(transforms);
		var difference = _.difference(transforms, addonTransforms);
		if (difference.length < transforms.length) {
			log.warn('Adding existing transforms to %s will be ignored: %s', api.packageName, new Error('Duplicated transform').stack);
		}
		[].push.apply(addonTransforms, difference);
	}
};


var log4jsToNpmLogLevel = {
	OFF: 'error',
	MARK: 'error',
	FATAL: 'error',
	ERROR: 'error',
	WARN: 'warn',
	INFO: 'info',
	DEBUG: 'verbose',
	TRACE: 'silly',
	ALL: 'silly'
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
	injector.fromAllPackages()
	.replaceCode('__api', '__api')
	.substitute(/^([^\{]*)\{locale\}(.*)$/,
		(filePath, match) => match[1] + api.getBuildLocale() + match[2]);

	injector.readInjectFile('browserify-inject.js');
	Object.getPrototypeOf(api).browserInjector = injector;
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
	//var buildJS = true;
	var cssPromises = [];
	var jsStreams = [];
	var staticDir = Path.resolve(config().staticDir);
	var packageInfo = walkPackages(config, argv, packageUtils, api.compileNodePath);
	initInjector(packageInfo);
	var helper = helperFactor(config, injector);
	var defaultBrowserSideConfigProp = [
		'staticAssetsURL', 'serverURL', 'packageContextPathMapping',
		'locales', 'devMode'
	];

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
		log.info('Only JS compilation');
	}

	var entryBootstrapTpl = _.template(fs.readFileSync(Path.join(__dirname, 'templates', 'entryBootstrap.js.tmpl'), 'utf8'),
	{
		interpolate: /\{\{([\s\S]+?)\}\}/g,
		evaluate: /\{%([\s\S]+?)%\}/g
	});

	var labJSBundle = packageInfo.moduleMap['@dr-core/labjs'].bundle;

	var cssStream = through.obj(function(path, enc, next) {
		fileAccessAsync(path, fs.R_OK).then(()=> {
			return readFileAsync(path, 'utf8');
		})
		.then((data) => {
			var file = new File({
				// gulp-rev-all is so stupid that it can only accept same `base` for all files,
				// So css files' base path must be sames as JS files.
				// To make rev-all think they are all based on config().rootPath, I have to change a
				// css file's path to a relative 'fake' location as as JS files.
				// Otherwise rev-manifest.json will be screwed up.
				path: Path.resolve(Path.relative(staticDir, path)),
				contents: new Buffer(data)
			});
			this.push(file);
		})
		.catch((err)=>{}).finally(()=> next());
	});

	var rejectOnError;

	return Promise.coroutine(function*() {
		yield depCtl.initAsync(api, packageInfo);
		yield buildStart();
		walkPackages.saveCache(packageInfo);
		return depCtl.tailDown();
	})()
	.then(() => {
		log.info('Yeh!');
	})
	.catch( err => {
		gutil.beep();
		if (err instanceof Error)
			throw err;
		else
			throw new Error(err);
		//process.exit(1);
	});

	function buildStart() {
		return new Promise(function(resolve, reject) {
			rejectOnError = reject;
			log.info('------- building bundles ---------');
			bundleNames.forEach(function(bundle) {
				log.info(chalk.inverse(bundle));
				var buildObj = buildBundle(packageInfo.bundleMap[bundle],
					bundle, config().staticDir);
				if (buildCss) {
					cssPromises.push(buildObj.cssPromise.then(filePath => {
						cssStream.write(filePath);
						return null;
					}));
				}
				jsStreams.push(buildObj.jsStream);
			});
			var pageCompiler = new PageCompiler(addonTransforms);
			var outStreams = jsStreams;
			if (buildCss) {
				outStreams.push(cssStream);
				Promise.all(cssPromises).then(()=> {
					cssStream.end();
				})
				.catch(err => {
					gutil.beep();
					reject(err);
				});
			}
			bundleStream = es.merge(outStreams)
			.on('error', function(er) {
				log.error('merged bundle stream error', er);
				gutil.beep();
				reject(er);
			});

			var pageCompilerParam = {};

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
						builtBundles: bundleNames,
						labJSBundleName: labJSBundle
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
					pageCompilerParam.labjsBundleMetadata = getLabjsBundleMetadata(pageCompilerParam.revisionMeta);
					runTasks().then(getDataFuncs => {
						pageCompilerParam.createEntryBootstrapCode = function(entryPackageName, writeCss) {
							return createEntryBootstrapCode(entryPackageName, pageCompilerParam.revisionMeta, entryDataProvider, writeCss);
						};
						callback();

						function entryDataProvider(entryPackageName) {
							var browserApi = {};
							monkeyPatchBrowserApi(browserApi, entryPackageName, depsGraph, pageCompilerParam.revisionMeta);
							getDataFuncs.forEach(getData => {
								getData(browserApi, entryPackageName);
							});
							return browserApi;
						}
					});
				}))
			.pipe(pageCompiler.compile('server'))
			.pipe(gulp.dest(Path.join(config().destDir, 'server' + (api.isDefaultLocale() ? '' : '/' + api.getBuildLocale()))))
			.pipe(pageCompiler.compile('static'))
			.pipe(gulp.dest(config().staticDir + (api.isDefaultLocale() ? '' : '/' + api.getBuildLocale())))
			.pipe(pageCompiler.dependencyApiData())
			.pipe(gulp.dest(config().destDir))
			.on('end', resolve);
		});
	}

	/**
	 * Browser side bootstrap code
	 */
	function createEntryBootstrapCode(entryPackageName, revisionMeta, entryDataProvider, writeCss) {
		var loadingData = getBundleMetadataForEntry(entryPackageName, revisionMeta);

		var bootstrapCode = entryBootstrapTpl({
			cssPaths: writeCss ? JSON.stringify(loadingData.css, null, '  ') : null,
			jsPaths: JSON.stringify(loadingData.js, null, '  '),
			staticAssetsURL: config.get('staticAssetsURL'),
			entryPackage: entryPackageName,
			debug: !!api.config.get('devMode'),
			lrEnabled: api.config.get('devMode') && api.config.get('livereload.enabled', true),
			lrport: api.config.get('livereload.port'),
			data: JSON.stringify(entryDataProvider(entryPackageName), null, '  ')
		});
		var rpr = api.config.get([api.packageName, 'replaceRequireKeyword']) || api.config.get([api.packageShortName, 'replaceRequireKeyword']);
		if (rpr) {
			log.info('Option replaceRequireKeyword is on');
			bootstrapCode = esParser.replaceRequireKeyword(bootstrapCode, rpr);
		}
		if (!api.config().devMode)
			bootstrapCode = require('uglify-js').minify(bootstrapCode, {fromString: true}).code;
		return bootstrapCode;
	}

	function buildBundle(modules, bundle, destDir) {
		var browserifyOpt = {
			debug: config().enableSourceMaps,
			paths: api.compileNodePath,
			basedir: config().rootPath,
			noParse: config().browserifyNoParse ? config().browserifyNoParse : []
		};
		if (config.get([api.packageName, 'standalone']))
			browserifyOpt.standalone = 'js' + bundle + '.sta';
		var mIdx = 1;
		var moduleCount = _.size(modules);
		_.each(modules, function(moduleInfo) {
			if (moduleInfo.browserifyNoParse) {
				moduleInfo.browserifyNoParse.forEach(function(noParseFile) {
					var file = Path.resolve(moduleInfo.packagePath, noParseFile);
					if (fs.existsSync(file))
						file = fs.realpathSync(file);
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
		var jsBundleEntryMaker = helper.JsBundleEntryMaker(api, bundle, modules, depCtl.fileSplitPointMap);
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
		b.transform(jsBundleEntryMaker.transform(api.getBuildLocale()), {global: true});

		//var excludeList =
		excludeModules(packageInfo, b, _.map(modules, function(module) {return module.longName;}));
		//excludeI18nModules(packageInfo.allModules, b);

		var cssPromise = buildCssBundle(b, bundle, destDir);

		// draw a cross bundles dependency map
		depCtl.browserifyDepsMap(b);
		var jsStream = _createBrowserifyBundle(b, bundle, rejectOnError);

		// var i18nBuildRet = buildI18nBundles(browserifyOpt, modules, excludeList, bundle, entryJsDir);
		// if (i18nBuildRet) {
		// 	jsStream = es.merge([jsStream, i18nBuildRet[0]]);
		// 	cssPromises = cssPromises.concat(i18nBuildRet[1]);
		// }
		return {
			cssPromise: cssPromise,
			jsStream: jsStream
		};
	}

	function monkeyPatchBrowserApi(browserApi, entryPackage, depsGraph, revisionMeta) {
		// setup server side config setting to browser
		browserApi._config = {};
		var setting = api.config();
		var deps = depCtl.packageDepsAndSplitPoints(entryPackage);
		deps[entryPackage] = true; // Including itself
		var browserPropSet = {};
		_.each(deps, (v, name) => {
			var pkConfig = _.get(packageInfo.moduleMap, [name, 'dr', 'browserSideConfigProp']);
			if (!pkConfig)
				return;
			_.each(pkConfig, prop => browserPropSet[prop] = true);
		});
		_.each(defaultBrowserSideConfigProp, prop => browserPropSet[prop] = 1);
		_.each(setting.browserSideConfigProp, prop => browserPropSet[prop] = 1);
		_.forOwn(browserPropSet, (nothing, propPath) => _.set(browserApi._config, propPath, _.get(setting, propPath)));

		browserApi.buildLocale = api.getBuildLocale();
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
		_.remove(entryMetadata.bundles, b => b === labJSBundle); // make sure there is no duplicate labjs bundle
		var cdnUrls = depCtl.cdnUrls(entryPackage);
		var metadata = {
			js: bundles2FilePaths(entryMetadata.bundles, 'js', revisionMeta),
			css: bundles2FilePaths(entryMetadata.bundles, 'css', revisionMeta)
		};
		[].push.apply(metadata.js, cdnUrls.js);
		[].push.apply(metadata.css, cdnUrls.css);
		return metadata;
	}

	function getLabjsBundleMetadata(revisionMeta) {
		return {
			js: bundles2FilePaths([labJSBundle], 'js', revisionMeta),
			css: bundles2FilePaths([labJSBundle], 'css', revisionMeta)
		};
	}

	function bundles2FilePaths(bundles, type, revisionMeta) {
		var paths = [];
		_.each(bundles, bundle => {
			var file = type + '/' + bundle + ((config().devMode || type === 'css') ? '' : '.min') + '.' + type;
			if (_.has(packageInfo.bundleUrlMap, bundle)) {
				var urls = packageInfo.bundleUrlMap[bundle];
				if (_.isArray(urls)) {
					if (urls.length > 0)
						log.info(`Replace bundle "${bundle}" with CDN resources:`);
					_.each(urls, url => {
						if (url.endsWith('.' + type)) {
							paths.push(url);
							log.info(`   ${type} ${url}`);
						}
					});
				} else if (_.has(urls, type)){
					log.info(`Replace bundle "${bundle}" with CDN resources:`);
					_.each([].concat(urls[type]), url => {
						paths.push(url);
						log.info(`   ${type} ${url}`);
					});
				}
			} else if (_.has(revisionMeta, file)) {
				paths.push(api.localeBundleFolder() + revisionMeta[file]);
			}
		});
		return paths;
	}

	function excludeModules(info, b, entryModules) {
		var excludeList = [];
		info.allModules.forEach(function(pkModule) {
			if (!_.includes(entryModules, pkModule.longName) && !_.has(info.noBundlePackageMap, pkModule.longName)) {
				b.exclude(pkModule.longName);
				excludeList.push(pkModule.longName);
			}
		});
		return excludeList;
	}
	/*
	function excludeI18nModules(allModules, b) {
		allModules.forEach((pkModule) => {
			b.exclude(pkModule.longName + '/i18n');
		});
	}
	*/
	function revisionBundleFile(bundleStream) {
		var revAll = new RevAll();
		var localeDir = api.localeBundleFolder();
		var stream;
		if (config().devMode) {
			var fakeRevManifest = {};

			stream = bundleStream
			.pipe(gulp.dest(config().staticDir + (localeDir ? '/' + localeDir : '')))
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
			.pipe(gulp.dest(config().staticDir + (localeDir ? '/' + localeDir : '')))
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
		if (!buildCss)
			return Promise.resolve(null);
		mkdirp.sync(Path.resolve(destDir, 'css'));
		var fileName = Path.resolve(destDir, 'css', bundle + '.css');
		var appTransforms = ['@dr/parcelify-module-resolver'];
		// addonTransforms.forEach(addonTransform => {
		// 	appTransforms.push(addonTransform);
		// });
		log.debug('parcelify css bundle: %s', bundle);
		var parce = parcelify(b, {
			bundles: {
				style: fileName
			},
			appTransforms: appTransforms,
			logLevel: log4jsToNpmLogLevel[log.level.levelStr]
		});
		return new Promise(function(resolve, reject) {
			parce.on('done', function() {
				log.debug('buildCssBundle() built out: ' + fileName);
				resolve(fileName);
			});

			parce.on('error', function(err) {
				log.error('parcelify bundle error: ', err);
				gutil.beep();
				reject(new Error(fileName));
			});
			// this is a work around for a bug introduced in Parcelify
			// check this out, https://github.com/rotundasoftware/parcelify/issues/30
			b.pipeline.get('dedupe').push( through.obj( function( row, enc, next ) {
				if (Path.isAbsolute(row.file)) {
					if (fs.lstatSync(row.file).isDirectory()) {
						// most likely it is an i18n folder
						row.file = bResolve(row.file);
					}
				} else {
					// row.file is a package name
					// Use fs.realpathSync to make sure those symbolic link directories
					// can work with Parcelify
					var resolved = packageInfo.moduleMap[row.id] ? fs.realpathSync(packageInfo.moduleMap[row.id].file) : null;
					log.debug('resolving %s', row.file);
					row.file = resolved ? resolved : bResolve(row.file);
				}
				this.push(row);
				next();
			}));
		});
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

function _createBrowserifyBundle(b, bundle, handleError) {
	var bundleBasename = 'js/' + bundle;
	var out = b.bundle()
		.on('error', (er) => {
			log.error('browserify bundle() for bundle "' + bundle + '" failed');
			gutil.beep();
			out.end();
			handleError(er);
		});
	var rpr = config.get([api.packageName, 'replaceRequireKeyword']) || config.get([api.packageShortName, 'replaceRequireKeyword']);
	if (rpr) {
		var buf = '';
		out = out.pipe(through(function(chunk, enc, cb) {
			buf += chunk;
			cb();
		}, function(cb) {
			this.push(esParser.replaceRequireKeyword(buf, rpr));
			cb();
		}));
	}
	out = out.pipe(source(bundleBasename + '.js'))
		.pipe(buffer())
		//.pipe(gulpif(config().enableSourceMaps, sourcemaps.init()))
		.pipe(gulpif(!config().devMode, uglify()))
		.pipe(gulpif(!config().devMode, rename(bundleBasename + '.min.js')))
		//.pipe(gulpif(config().enableSourceMaps, sourcemaps.write('./sourcemaps', {
			//sourceMappingURLPrefix: config().staticAssetsURL
		//})))
		.pipe(gulpif(!config().devMode, size({
			showFiles: true,
			gzip: true,
			showTotal: false
		})))
		.on('error', (er) => {
			log.error('browserify bundle() sourcemaps failed');
			out.end();
			handleError(er);
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
