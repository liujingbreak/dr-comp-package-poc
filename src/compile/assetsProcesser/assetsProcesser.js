var gulp = require('gulp');
var through = require('through2');
var Path = require('path');
var fs = require('fs');
var es = require('event-stream');
var log;
var buildUtils = require('@dr/environment').buildUtils;

var packageUtils, config;

module.exports = {
	compile: compile
};

function compile(api) {
	log = require('log4js').getLogger(api.packageName);
	var argv = api.argv;
	packageUtils = api.packageUtils;
	config = api.config;
	if (config().devMode && argv.p && argv.p !== 'assets') {
		return;
	}
	return copyAssets();
}

function copyAssets() {
	var src = [];
	var streams = [];
	packageUtils.findBrowserPackageByType(['*'], function(name, entryPath, parsedName, json, packagePath) {
		var baseDir = Path.join(packagePath, 'assets');
		if (fs.existsSync(baseDir)) {
			src.push(Path.join(packagePath, 'assets', '**', '*'));
			var stream = gulp.src(src, {base: baseDir})
			.pipe(through.obj(function(file, enc, next) {
				file.path = Path.join(baseDir, parsedName.name, Path.basename(file.path));
				log.debug(file.path);
				//file.path = file.path
				next(null, file);
			}));
			streams.push(stream);
		}
	});

	return es.merge(streams)
	.pipe(gulp.dest(Path.join(config().destDir, 'static', 'assets')))
	.on('end', function() {
		log.debug('flush');
		buildUtils.writeTimestamp('assets');
	});
}
