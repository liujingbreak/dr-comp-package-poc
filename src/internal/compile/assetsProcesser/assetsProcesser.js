var gulp = require('gulp');
var through = require('through2');
var Path = require('path');
var fs = require('fs');
var es = require('event-stream');
var _ = require('lodash');
var shell = require('shelljs');
var mkdirp = require('mkdirp');
var api = require('__api');
var log = require('log4js').getLogger(api.packageName);
var serverFavicon = require('serve-favicon');
var buildUtils = api.buildUtils;

var packageUtils = api.packageUtils;
var config = api.config;

module.exports = {
	compile: compile,
	activate: activate
};

function compile(api) {
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
	var staticFolder = api.config.resolve('staticDir');
	log.debug('express static path: ' + staticFolder);

	var favicon = findFavicon();
	if (favicon)
		require('@dr-core/express-app').app.use(serverFavicon(favicon));
	api.use('/', api.express.static(staticFolder, {
		maxAge: api.config().cacheControlMaxAge,
		setHeaders: setCORSHeader
	}));
	// api.get('/', function(req, res) {
	// 	res.render('index.html', {});
	// });

	if (!api.config().devMode) {
		return;
	}

	api.packageUtils.findAllPackages((name, entryPath, parsedName, json, packagePath) => {
		var assetsFolder = json.dr ? (json.dr.assetsDir ? json.dr.assetsDir : 'assets') : 'assets';
		var assetsDir = Path.join(packagePath, assetsFolder);
		if (fs.existsSync(assetsDir)) {
			var path = '/' + parsedName.name;
			log.info('route ' + path + ' -> ' + assetsDir);
			api.use(path + '/', api.express.static(assetsDir, {
				setHeaders: function(res) {
					res.setHeader('Access-Control-Allow-Origin', '*');
				}
			}));
		}
	});
}

function copyRootPackageFavicon() {
	var favicon = findFavicon();
	if (!favicon)
		return;
	log.info('Copy favicon.ico from ' + favicon);
	mkdirp.sync(config.resolve('staticDir'));
	shell.cp('-f', Path.resolve(favicon), Path.resolve(config().rootPath, config.resolve('staticDir')));
}

function findFavicon() {
	return _findFaviconInConfig('packageContextPathMapping') || _findFaviconInConfig('entryPageMapping');
}

function _findFaviconInConfig(property) {
	if (!api.config()[property]) {
		return null;
	}
	var faviconFile = null;
	var faviconPackage;
	_.each(config()[property], (path, pkName) => {
		if (path === '/') {
			packageUtils.lookForPackages(pkName, (fullName, entryPath, parsedName, json, packagePath) => {
				var assetsFolder = json.dr ? (json.dr.assetsDir ? json.dr.assetsDir : 'assets') : 'assets';
				var favicon = Path.join(packagePath, assetsFolder, 'favicon.ico');
				if (fs.existsSync(favicon)) {
					if (faviconFile) {
						log.warn('Found duplicate favicon file in', fullName, 'existing', faviconPackage);
					}
					faviconFile = Path.resolve(favicon);
				}
			});
		}
	});
	return faviconFile;
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

function setCORSHeader(res) {
	res.setHeader('Access-Control-Allow-Origin', '*');
}
