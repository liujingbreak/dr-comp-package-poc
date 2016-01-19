var gulp = require('gulp');
var Path = require('path');
var gutil = require('gulp-util');
var jshint = require('gulp-jshint');
var jscs = require('gulp-jscs');
var bump = require('gulp-bump');
var changed = require('gulp-changed');
// var watchify = require('watchify');
var browserify = require('browserify');
var es = require('event-stream');
var vp = require('vinyl-paths');
var del = require('del');
var jscs = require('gulp-jscs');
var vps = require('vinyl-paths');
var Q = require('q');
var linkPackage = require('./lib/gulp/linkPackage');
var findPackageJson = require('./lib/gulp/findPackageJson');
var rwPackageJson = require('./lib/gulp/rwPackageJson');

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

gulp.task('link', function() {
	gulp.src('src')
	.pipe(findPackageJson())
	.on('error', gutil.log)
	.pipe(changed('node_modules'))
	.pipe(vps(function(paths) {
		gutil.log('changed: ' + paths);
		return Promise.resolve();
	}))
	.pipe(rwPackageJson.linkPkJson('node_modules'))
	.on('error', gutil.log)
	.pipe(gulp.dest('node_modules'))
	.on('error', gutil.log)
	.pipe(rwPackageJson.addDependeny('package.json'));
});

gulp.task('browserify', function() {

});

gulp.task('bump-version', function() {
	return es.merge(
		gulp.src('src')
			.pipe(findPackageJson())
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
