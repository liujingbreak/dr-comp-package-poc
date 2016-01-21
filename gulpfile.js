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

var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var size = require('gulp-size');
var cli = require('shelljs-nodecli');
var pBundle = require('partition-bundle');
var shasum = require('shasum');
var rename = require('gulp-rename');

var findPackageJson = require('./lib/gulp/findPackageJson');
var rwPackageJson = require('./lib/gulp/rwPackageJson');
var depScanner = require('./lib/gulp/dependencyScanner');
var packageUtils = require('./lib/packageMgr/packageUtils');

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

/**
 * TODO: changed() seems not working
 */
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

/**
 * Need refactor
 * TODO: partition-bundle, deAMDify, Parcelify
 */
gulp.task('browserify', function() {
	var browserifyTask = [];
	packageUtils.findBrowserEntryFiles('package.json', function(moduleName, entryPath, parsedName) {
		gutil.log('entry: ' + parsedName.name);
		var def = Q.defer();
		browserifyTask.push(def.promise);
		var b = browserify({
			debug: true
		});
		b.add(entryPath);
		b.bundle()
		.pipe(source(parsedName.name + '.js'))
		.pipe(buffer())
		.pipe(gulp.dest('./dist/js/'))
		.pipe(rename(parsedName.name + '.min.js'))
		.pipe(sourcemaps.init({
			loadMaps: true
		}))
		// Add transformation tasks to the pipeline here.
		.pipe(uglify())
		.on('error', gutil.log)
		.pipe(sourcemaps.write('./'))
		.pipe(size())
		.pipe(gulp.dest('./dist/js/'))
		.on('end', function() {
			def.resolve();
		});
	});
	return Q.allSettled(browserifyTask);
});

/**
 * TODO: bump dependencies version
 */
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
	//todo bump dependencies' version
});

gulp.task('publish', function() {
	return gulp.src('src')
		.pipe(findPackageJson())
		.on('error', gutil.log)
		.pipe(vps(function(paths) {
			gutil.log(paths);
			//packages.push(Path.dirname(paths));
			cli.exec('npm', 'publish', Path.dirname(paths));
			return Promise.resolve();
		})).on('end', function() {
			cli.exec('npm', 'publish', '.');
		});
});

function bumpVersion() {
	return bump({
		type: 'patch'
	});
}
