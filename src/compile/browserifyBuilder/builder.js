var _ = require('lodash');
var resolve = require('browser-resolve');
var fs = require('fs');
var Path = require('path');
var util = require('util');
var Q = require('q');
var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var size = require('gulp-size');
var gulp = require('gulp');
var gutil = require('gulp-util');
var rev = require('gulp-rev');

var log = require('@dr/logger').getLogger('browserifyBuilder.builder');
var packageBrowserInstance = require('./packageBrowserInstance');
var helper = require('./browserifyHelper');

var packageUtils, config, jsDest, textHtmlTranform, bundleBootstrap;
var bundleInfo;

module.exports = function(_packageUtils, _config, destDir) {
	packageUtils = _packageUtils;
	config = _config;
	jsDest = Path.resolve(destDir, 'js');
	helper = helper(config);
	log.debug(helper);
	textHtmlTranform = helper.textHtmlTranform;
	bundleBootstrap = helper.BrowserSideBootstrap();


	var browserifyTask = [];
	bundleInfo = bundleMapInfo(Path.resolve(config().rootPath, config().recipeFolder, 'package.json'));
	log.debug('bundles: ' + util.inspect(_.keys(bundleInfo.bundleMap)));

	_.forOwn(bundleInfo.bundleMap, function(modules, bundle) {
		log.info('build bundle: ' + bundle);
		var def = Q.defer();
		browserifyTask.push(def.promise);
		buildBundle(modules, bundle, jsDest)
		.on('end', function() {
			def.resolve();
		});
	});
};

function bundleMapInfo(packageJsonFile) {
	var info = {
		allModules: null,
		bundleMap: null,
	};
	var recipePackageJson = JSON.parse(fs.readFileSync(packageJsonFile, 'utf-8'));
	if (!recipePackageJson.dependencies) {
		return {};
	}
	var vendorConfigInfo = vendorBundleMapConfig();
	var map = info.bundleMap = vendorConfigInfo.bundleMap;
	info.allModules = vendorConfigInfo.allModules;

	packageUtils.findBrowserPackageByType(['core', null], function(name, entryPath, parsedName, pkJson) {
		var bundle;
		if (!pkJson.dr) {
			bundle = parsedName.name;
		} else if (!pkJson.dr.builder || pkJson.dr.builder === 'browserify') {
			bundle = pkJson.dr.bundle || pkJson.dr.chunk;
			bundle = bundle ? bundle : parsedName.name;
		} else {
			return;
		}
		info.allModules.push(name);

		if (!map.hasOwnProperty(bundle)) {
			map[bundle] = [];
		}
		map[bundle].push(packageBrowserInstance({
			bundle: bundle,
			longName: name,
			file: resolve.sync(name),
			parsedName: parsedName,
			active: pkJson.dr ? pkJson.dr.active : false
		}, config()));
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
			info.allModules.push(moduleName);
			return {
				longName: moduleName,
				shortName: moduleName,
				file: resolve.sync(moduleName)
			};
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
	excludeModules(bundleInfo.allModules, b, modules);

	//TODO: algorithm here can be optmized
	function excludeModules(allModules, b, entryModules) {
		allModules.forEach(function(moduleName) {
			if (!_.includes(entryModules, moduleName)) {
				b.exclude(moduleName);
			}
		});
	}

	return b.bundle()
		.on('error', gutil.log)
		.pipe(source(bundle + '.js'))
		.pipe(buffer())
		// .pipe(gulp.dest('./dist/js/'))
		// .on('error', gutil.log)
		// .pipe(rename(bundle + '.min.js'))
		// .pipe(rev())
		.on('error', gutil.log)
		.pipe(sourcemaps.init({
			loadMaps: true
		}))
		// Add transformation tasks to the pipeline here.
		//.pipe(uglify())
		.on('error', gutil.log)
		.pipe(sourcemaps.write('./'))
		.pipe(size())
		.pipe(gulp.dest(jsDest))
		.pipe(rev.manifest({merge: true}))
		.pipe(gulp.dest(jsDest))
		.on('error', gutil.log);
}
