var gulp = require('gulp');
var through = require('through2');
var Path = require('path');
var fs = require('fs');
var es = require('event-stream');
var _ = require('lodash');
var shell = require('shelljs');
var log;
var env = require('@dr/environment');
var resolveStaticUrl = require('@dr-core/browserify-builder-api').resolveUrl;
var buildUtils = env.buildUtils;

var packageUtils, config;

module.exports = {
	compile: compile,
	replaceAssetsUrl: replaceAssetsUrl
};

function compile(api) {
	log = require('log4js').getLogger(api.packageName);
	var argv = api.argv;
	packageUtils = api.packageUtils;
	config = api.config;
	copyRootPackageFavicon();
	if (config().devMode && (!argv.p || argv.p && argv.p !== 'assets')) {
		log.info('DevMode enabled, skip copying assets to static folder');
		return;
	}
	return copyAssets();
}

function copyRootPackageFavicon() {
	if (!config().packageContextPathMapping) {
		return;
	}
	_.some(config().packageContextPathMapping, (path, pkName) => {
		if (path === '/') {
			packageUtils.lookForPackages(pkName, (fullName, entryPath, parsedName, json, packagePath) => {
				var assetsFolder = json.dr ? (json.dr.assetsDir ? json.dr.assetsDir : 'assets') : 'assets';
				var favicon = Path.join(packagePath, assetsFolder, 'favicon.ico');
				if (fs.existsSync(favicon)) {
					log.info('Copy favicon.ico from ' + favicon);
					shell.cp('-f', Path.resolve(favicon), Path.resolve(config().rootPath, config().staticDir));
				}
			});
			return true;
		}
		return false;
	});
}

function copyAssets() {
	var src = [];
	var streams = [];
	packageUtils.findBrowserPackageByType(['*'], function(name, entryPath, parsedName, json, packagePath) {
		var assetsFolder = json.dr ? (json.dr.assetsDir ? json.dr.assetsDir : 'assets') : 'assets';
		var assetsDir = Path.join(packagePath, assetsFolder);
		if (fs.existsSync(assetsDir)) {
			src.push(Path.join(packagePath, assetsFolder, '**', '*'));
			var stream = gulp.src(src, {base: Path.join(packagePath, assetsFolder)})
			.pipe(through.obj(function(file, enc, next) {
				var pathInPk = Path.relative(assetsDir, file.path);
				file.path = Path.join(assetsDir, parsedName.name, pathInPk);
				log.debug(file.path);
				//file.path = file.path
				next(null, file);
			}));
			streams.push(stream);
		}
	});
	if (streams.length === 0) {
		return null;
	}
	return es.merge(streams)
	.pipe(gulp.dest(Path.join(config().staticDir)))
	.on('end', function() {
		log.debug('flush');
		buildUtils.writeTimestamp('assets');
	});
}

function replaceAssetsUrl(str, getCurrPackage) {
	return str.replace(/([^a-zA-Z\d_.]|^)assets:\/\/((?:@[^\/]+\/)?[^\/]+)?(\/.*?)(['"),;:!\s]|$)/gm,
		(match, leading, packageName, path, tail) => {
			if (!packageName || packageName === '') {
				packageName = getCurrPackage();
			}
			if (packageName) {
				log.info('resolve assets to ' + packageName);
			}
			var resolvedTo = leading + resolveStaticUrl(env.config, packageName, path) + tail;
			log.debug('-> ' + resolvedTo);
			return resolvedTo;
		});
}
