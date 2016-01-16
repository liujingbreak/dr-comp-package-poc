var gulp = require('gulp');
var Path = require('path');
var gutil = require('gulp-util');
var jshint = require('gulp-jshint');
var jscs = require('gulp-jscs');
var bump = require('gulp-bump');
// var watchify = require('watchify');
//var browserify = require('browserify');
var es = require('event-stream');
var vp = require('vinyl-paths');
var del = require('del');
var jscs = require('gulp-jscs');
var fs = require('fs');
var log = require('log4js').getLogger('gulpfile');
var Q = require('q');
var mkdirs = require('mkdirs');
var pkutil = require('./lib/packageMgr/packageUtils');

var SCOPE_NAME = 'dr';

gulp.task('default', function() {
	// place code for your default task here
});

gulp.task('clean:dr', function() {
	return del(['node_modules/@' + SCOPE_NAME,
		'bower_components/@' + SCOPE_NAME
	]);
});

gulp.task('clean', ['clean:dr']);

gulp.task('jscs', function() {
	gulp.src(['*.js',
		'lib/**/*.js'
	]).pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'))
	.pipe(jshint.reporter('fail'))
	.pipe(jscs())
	.pipe(jscs.reporter())
	.pipe(jscs.reporter('fail'));
});

gulp.task('lp', function() {
	return Q.all(linkPackageJson('src'));
});

function linkPackageJson(parentDir) {
	var folders = fs.readdirSync(parentDir);
	var qs = [];
	folders.forEach(function(name) {
		var dir = Path.join(parentDir, name);
		if (fs.statSync(dir).isDirectory()) {
			var pkJsonPath = Path.join(dir, 'package.json');
			if (fs.existsSync(pkJsonPath)) {
				qs.push(replicatePackageJson(pkJsonPath));
			} else {
				qs = qs.concat(linkPackageJson(dir));
			}
		}
	});
	return qs;
}

function replicatePackageJson(oldPath) {
	log.debug('found ' + oldPath);
	return Q.nfcall(fs.readFile, oldPath, {encoding: 'utf-8'})
	.then(function(content) {
		var json = JSON.parse(content);
		if (json.main) {
			var relativePath = Path.relative(
				Path.join('node_modules', '@dr', 'someguy'),
				Path.join(Path.dirname(oldPath), json.main));
			log.debug('link "main" to ' + relativePath);
			json.main = relativePath;
		}

		var packageNameObj = pkutil.parseName(json.name);
		var newDir = Path.join('node_modules',
			'@' + packageNameObj.scope,
			packageNameObj.name);
		mkdirs(newDir);
		var newPackageJson = Path.join(newDir, 'package.json');
		log.debug('write to ' + newPackageJson);
		return Q.nfcall(fs.writeFile, newPackageJson,
			JSON.stringify(json, null, '\t'));
	});
}

gulp.task('bump-version', function() {
	return es.merge(
		gulp.src('./src/**/package.json')
			.pipe(vp(function(path) {
				return new Promise(function(resolve, reject) {
					gulp.src(path).pipe(bumpVersion())
						.on('error', gutil.log)
						.pipe(gulp.dest(Path.dirname(path)))
						.on('end', resolve);
				});
			})),
		gulp.src('./package.json')
			.pipe(bumpVersion())
			.on('error', gutil.log)
			.pipe(gulp.dest('.'))
		);
});

function bumpVersion() {
	return bump({type: 'patch'});
}
