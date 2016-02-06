var util = require('util');
var gulp = require('gulp');
var Path = require('path');
var gutil = require('gulp-util');
var jshint = require('gulp-jshint');
var jscs = require('gulp-jscs');
var bump = require('gulp-bump');
// var watchify = require('watchify');
var es = require('event-stream');
var vp = require('vinyl-paths');
var del = require('del');
var jscs = require('gulp-jscs');
var vps = require('vinyl-paths');
var Q = require('q');
Q.longStackSupport = true;
var _ = require('lodash');
var RevAll = require('gulp-rev-all');

var cli = require('shelljs-nodecli');
var Jasmine = require('jasmine');

var findPackageJson = require('./lib/gulp/findPackageJson');
var rwPackageJson = require('./lib/gulp/rwPackageJson');
var packageUtils = require('./lib/packageMgr/packageUtils');

var config = require('./lib/config');

var DEST = Path.resolve(__dirname, config().destDir);

gulp.task('default', function() {
	gutil.log('please individually execute gulp [task]');
	gutil.log('\tbuild clean, link, compile, bump-version, publish');
});

gulp.task('clean:dependency', function() {
	var dirs = [];
	_.each(config().packageScopes, function(packageScope) {
		var npmFolder = Path.resolve('node_modules', '@' + packageScope);
		gutil.log('delete ' + npmFolder);
		dirs.push(npmFolder);
	});
	return del(dirs).then(gutil.log, gutil.log);
});

gulp.task('clean:dist', function() {
	return del([config().destDir, config().compiledDir]);
});

gulp.task('clean', ['clean:dist', 'clean:dependency']);

gulp.task('build', ['install-recipe'], function() {
	var gulpStart = _.bind(gulp.start, gulp);
	return Q.nfcall(gulpStart, 'compile');
});

gulp.task('install-recipe', ['link'], function() {
	cli.exec('npm', 'install', './package-recipe');
	return Promise.resolve();
});

gulp.task('lint', function() {
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
 * link src/ ** /package.json from node_modules folder
 */
gulp.task('link', function() {
	return gulp.src('src')
		.pipe(findPackageJson())
		.on('error', gutil.log)
		.pipe(rwPackageJson.linkPkJson('node_modules'))
		.on('error', gutil.log)
		.pipe(gulp.dest('node_modules'))
		.on('error', gutil.log)
		.pipe(rwPackageJson.addDependeny(Path.resolve(__dirname, config().recipeFolder, 'package.json')))
		.pipe(gulp.dest('.'));
});

gulp.task('compile', function() {
	var jobs = [];
	packageUtils.findNodePackageByType('builder', function(name, entryPath, parsedName, pkJson) {
		gutil.log('run builder: ' + name);
		var res = require(name)(packageUtils, config, DEST);
		if (res && _.isFunction(res.pipe)) {
			// is stream
			var job = Q.defer();
			jobs.push(job.promise);
			res.on('end', function() {
				job.resolve();
			}).on('error', function(er) {
				gutil.log(er);
				job.reject(er);
			});
		} else {
			jobs.push(res);
		}
	});

	return Q.all(jobs);
});

gulp.task('rev', function() {
	var revAll = new RevAll({
		debug: true,
		//dontRenameFile: [/\.html$/g]
	});
	gulp.src([config().destDir + '/js/**/*.min.js'])
	.pipe(revAll.revision())
	.pipe(gulp.dest(config().destDir) + '/js')
	.pipe(revAll.manifestFile())
	.pipe(gulp.dest(config().destDir));
});

/**
 * TODO: bump dependencies version
 */
gulp.task('bump', function() {
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

gulp.task('test-house', function() {
	var jasmine = new Jasmine();
	jasmine.loadConfigFile('spec/support/jasmine.json');
	jasmine.execute();
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
