var util = require('util');
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
Q.longStackSupport = true;
var _ = require('lodash');

var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');
var size = require('gulp-size');
var cli = require('shelljs-nodecli');
var shasum = require('shasum');
var rename = require('gulp-rename');
var Jasmine = require('jasmine');

var findPackageJson = require('./lib/gulp/findPackageJson');
var rwPackageJson = require('./lib/gulp/rwPackageJson');
var depScanner = require('./lib/gulp/dependencyScanner');
var packageUtils = require('./lib/packageMgr/packageUtils');
var textHtmlTranform = require('./lib/gulp/browserifyHelper').textHtml;
var bundleBootstrap = require('./lib/gulp/browserifyHelper').BrowserSideBootstrap();

var rev = require('gulp-rev');

var config = require('./lib/config');


gulp.task('default', function() {
	gutil.log('please individually execute gulp [task]');
	gutil.log('\tclean, link, browserify');
});

gulp.task('clean:dependency', function() {
	var dirs = [];
	_.each(config().packageScopes, function(packageScope) {
		var npmFolder = Path.resolve('node_modules', '@', packageScope);
		var bowerFolder = Path.resolve('node_modules', '@', packageScope);
		gutil.log('delete ' + npmFolder);
		gutil.log('delete ' + bowerFolder);
		dirs.push(npmFolder);
		dirs.push(bowerFolder);
	});
	return del(dirs);
});

gulp.task('clean:dist', function() {
	return del('dist');
});

gulp.task('clean', ['clean:dist', 'clean:dependency']);

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
	gulp.src('src')
		.pipe(findPackageJson())
		.on('error', gutil.log)
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
gulp.task('compile', function() {
	var browserifyTask = [];
	var info = packageUtils.bundleMapInfo(Path.resolve(__dirname, 'package.json'));
	gutil.log('bundles: ' + util.inspect(_.keys(info.bundleMap)));

	_.forOwn(info.bundleMap, function(modules, bundle) {
		gutil.log('build bundle: ' + bundle);
		var mIdx = 1;
		var moduleCount = _.size(modules);
		_.each(modules, function(moduleInfo) {
			if (mIdx === moduleCount) {
				gutil.log('\t└─ ' + moduleInfo.longName);
				return;
			}
			gutil.log('\t├─ ' + moduleInfo.longName);
			mIdx++;
		});

		var entryStream = bundleBootstrap.createBundleEntryFile(bundle, modules);
		var def = Q.defer();
		browserifyTask.push(def.promise);
		var b = browserify({
			debug: true
		});
		b.add(entryStream, {file: bundle + '.js'});
		modules.forEach(function(module) {
			b.require(module.longName);
		});
		b.transform(textHtmlTranform);
		excludeModules(b, modules);

		b.bundle()
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
		.pipe(gulp.dest('./dist/js/'))
		.pipe(rev.manifest({merge: true}))
		.pipe(gulp.dest('./dist/js/'))
		.on('error', gutil.log)
		.on('end', function() {
			def.resolve();
		});
	});

	function excludeModules(b, entryModules) {
		info.allModules.forEach(function(moduleName) {
			if (!_.includes(entryModules, moduleName)) {
				//gutil.log('\t\texclude ' + moduleName);
				b.exclude(moduleName);
			}
		});
	}

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
