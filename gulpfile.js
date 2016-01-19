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

gulp.task('xxx', function() {
	var deferred = Q.defer();
	setTimeout(function() {
		deferred.resolve();
	}, 100);
	return deferred.promise;
});

gulp.task('browserify', function() {
	var entries = [];
	var b;
	var finish = Q.defer();

	gulp.src('src')
		.pipe(findPackageJson())
		.pipe(rwPackageJson.readAsJson(function(json, file) {
			gutil.log('looking for entry file ' + file.path);
			if (json.browser && json.dr && json.dr.entry === true) {
				var entry = Path.join(Path.dirname(file.path), json.browser);
				entries.push(entry);
			}
			return file;
		})).on('end', function() {
			try {
				//gutil.log('here')
				if (entries.length === 0) {
					gutil.log('No entry found!');
				}
				gutil.log(entries);
				finish.resolve();
				// b = browserify({
				// 	entries: entries,
				// 	debug: true
				// });
				//
				// b.bundle()
				// 	.pipe(source('app.js'))
				// 	.pipe(buffer())
				// 	.pipe(sourcemaps.init({
				// 		loadMaps: true
				// 	}))
				// 	// Add transformation tasks to the pipeline here.
				// 	.pipe(uglify())
				// 	.on('error', gutil.log)
				// 	.pipe(sourcemaps.write('./'))
				// 	.pipe(gulp.dest('./dist/js/'))
				// 	.on('end', function() {
				// 		finish.resolve();
				// 	});
			} catch (er) {
				gutil.log(er);
			}
		}).on('error', gutil.log);

		setTimeout(function() {
			finish.resolve();
		}, 1100);
	return finish.promise;
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
	//todo bump dependencies' version
});

function bumpVersion() {
	return bump({
		type: 'patch'
	});
}
