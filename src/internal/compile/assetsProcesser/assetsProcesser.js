var gulp = require('gulp');
var through = require('through2');
var Path = require('path');
var fs = require('fs');
var es = require('event-stream');
var _ = require('lodash');
var shell = require('shelljs');
var mkdirp = require('mkdirp');
var log;
var env = require('@dr/environment');
var resolveStaticUrl = require('@dr-core/browserify-builder-api').resolveUrl;
var buildUtils = env.buildUtils;

var packageUtils, config;

module.exports = {
	compile: compile,
	activate: activate,
	replaceAssetsUrl: replaceAssetsUrl
};

function compile(api) {
	log = require('log4js').getLogger(api.packageName);
	var argv = api.argv;
	packageUtils = api.packageUtils;
	config = api.config;
	if (config().devMode && !argv.copyAssets) {
		log.info('DevMode enabled, skip copying assets to static folder');
		return;
	}
	copyRootPackageFavicon();
	return copyAssets();
}

function activate(api) {
	if (!api.config().devMode) {
		return;
	}
	log = require('log4js').getLogger(api.packageName);

	api.packageUtils.findAllPackages((name, entryPath, parsedName, json, packagePath) => {
		var assetsFolder = json.dr ? (json.dr.assetsDir ? json.dr.assetsDir : 'assets') : 'assets';
		var assetsDir = Path.join(packagePath, assetsFolder);
		if (fs.existsSync(assetsDir)) {
			var path = api.config().packageContextPathMapping[parsedName.name];
			path = path != null ? path : '/' + parsedName.name;
			log.debug('route ' + path + ' -> ' + assetsDir);
			api.use(path + '/', api.express.static(assetsDir, {
				setHeaders: function(res) {
					res.setHeader('Access-Control-Allow-Origin', '*');
				}
			}));
			if (path === '/') {
				log.debug('found root package ' + parsedName.nam);
				var favPath = Path.join(assetsDir, 'favicon.ico');
				if (fs.existsSync(favPath)) {
					log.debug('route favicon -> ' + favPath);
					api.use('/favicon.ico', (req, res, next) => {
						if (req.method !== 'GET') {
							next();
							return;
						}
						res.sendFile(favPath);
					});
				}
			}
		}
	});
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
					mkdirp.sync(config.resolve('staticDir'));
					shell.cp('-f', Path.resolve(favicon), Path.resolve(config().rootPath, config.resolve('staticDir')));
				}
			});
			return true;
		}
		return false;
	});
}

function copyAssets() {
	var streams = [];
	packageUtils.findBrowserPackageByType(['*'], function(name, entryPath, parsedName, json, packagePath) {
		var assetsFolder = json.dr ? (json.dr.assetsDir ? json.dr.assetsDir : 'assets') : 'assets';
		var assetsDir = Path.join(packagePath, assetsFolder);
		if (fs.existsSync(assetsDir)) {
			var src = [Path.join(packagePath, assetsFolder, '**', '*')];
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
	.pipe(gulp.dest(config.resolve('staticDir')))
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
