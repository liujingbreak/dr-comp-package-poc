var gulp = require('gulp');
var Promise = require('bluebird');
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

var cli = require('shelljs-nodecli');
var Jasmine = require('jasmine');

var findPackageJson = require('./lib/gulp/findPackageJson');
var rwPackageJson = require('./lib/gulp/rwPackageJson');
var packageLintableSrc = require('./lib/gulp/packageLintableSrc');
var packageUtils = require('./lib/packageMgr/packageUtils');
var argv = require('yargs').usage('Usage: $0 <command> [-b <bundle>] [-p package]')
	.command('build', 'build everything from scratch, including install-recipe, link, npm install, compile')
	.command('clean', 'cleanup build environment like dist folder, cache, recipe package.json, even those private modules in node_modules folder')
	.command('compile', 'compile static stuff like JS, less file into bundles, build command calls this command, depends on `gulp link`')
	.command('lint', 'source code style check')
	.describe('b', '<bundle-name> if used with command `compile` or `build`, it will only compile specific bundle, which is more efficient')
	.alias('b', 'bundle')
	.describe('p', '<package-short-name> if used with command `lint`, it will only check specific package')
	.alias('p', 'package')
	.demand(1)
	.help('h').alias('h', 'help')
	.argv;

var config = require('./lib/config');
require('log4js').configure(Path.join(__dirname, 'log4js.json'));

gulp.task('default', function() {
	gutil.log('please individually execute gulp [task]');
	gutil.log('\tbuild clean, link, compile [-b <bundle> ...], bump-version, publish');
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

gulp.task('clean:recipe', ['clean:recipe:internal'], function() {
	if (!config().recipeFolderPath) {
		return;
	}
	gulp.src(config().recipeFolderPath + '/package.json', {base: config().rootPath})
	.pipe(rwPackageJson.removeDependency())
	.pipe(gulp.dest('.'));
});

gulp.task('clean:recipe:internal', function() {
	if (config().dependencyMode) {
		return Promise.resolve();
	}
	if (config().internalRecipeFolderPath === config().recipeFolderPath) {
		return;
	}
	gulp.src(config().internalRecipeFolderPath + '/package.json', {base: __dirname})
	.pipe(rwPackageJson.removeDependency())
	.pipe(gulp.dest('.'));
});

gulp.task('clean:dist', function() {
	return del([config().destDir]);
});

gulp.task('clean', ['clean:dist', 'clean:dependency', 'clean:recipe']);

gulp.task('build', ['install-recipe', 'link'], function() {
	new Promise(function(resolve, reject) {
		// Use asynchronous `ShellJS.exec()` for long-lived process,
		// due to ShellJS's high CPU usage issue
		cli.exec('npm', 'install', function(code, output) {
			if (code === 0) {
				resolve();
			} else {
				reject(output);
			}
		});
	}).then(function() {
		var gulpStart = _.bind(gulp.start, gulp);
		return Q.nfcall(gulpStart, 'compile');
	});
});

gulp.task('install-recipe', ['link'], function() {
	var promises = [];
	if (!config().dependencyMode && config().internalRecipeFolderPath !== config().recipeFolderPath) {
		promises.push(installRecipe(config().internalRecipeFolderPath));
	}
	promises.push(installRecipe(config().recipeFolderPath));

	return Promise.all(promises);
});

function installRecipe(recipeDir) {
	return new Promise(function(resolve, reject) {
		cli.exec('npm', 'install', recipeDir, function(code, output) {
			if (code === 0) {
				resolve(code);
			} else {
				reject(output);
			}
		});
	});
}

gulp.task('lint', function() {
	es.merge([gulp.src(['*.js', 'lib/**/*.js'])]
		.concat(packageLintableSrc(packageUtils.findAllPackages, argv.p)))
	.pipe(jshint())
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
	return gulp.src(config().srcDir)
		.pipe(findPackageJson())
		.on('error', gutil.log)
		.pipe(rwPackageJson.linkPkJson('node_modules'))
		.on('error', gutil.log)
		.pipe(gulp.dest('node_modules'))
		.on('error', gutil.log)
		.pipe(rwPackageJson.addDependency(Path.resolve(config().rootPath, config().recipeFolder, 'package.json')))
		.pipe(gulp.dest('.'));
});

gulp.task('compile', function() {
	var jobs = [];
	require('@dr/environment')._setup(config, packageUtils); // monkey patch some useful objects
	packageUtils.findNodePackageByType('builder', function(name, entryPath, parsedName, pkJson) {
		gutil.log('run builder: ' + name);
		var res = require(name)(packageUtils, config, argv);
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

/**
 * TODO: bump dependencies version
 */
gulp.task('bump', function() {
	return es.merge(
		gulp.src(config().srcDir)
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
	return gulp.src(config().srcDir)
		.pipe(findPackageJson())
		.on('error', gutil.log)
		.pipe(vps(function(paths) {
			gutil.log(paths);
			return new Promise(function(resolve, reject) {
				cli.exec('npm', 'publish', Path.dirname(paths), {silent: false},
					function(code, output) {
						resolve(code);
					});
			});
		})).on('end', function() {
			if (config().dependencyMode) {
				cli.exec('npm', 'publish', config().recipeFolder);
			} else {
				cli.exec('npm', 'publish', config().internalRecipeFolderPath);
				if (config().recipeFolderPath &&
				config().recipeFolderPath !== config().internalRecipeFolderPath) {
					cli.exec('npm', 'publish', config().recipeFolderPath);
				}
				cli.exec('npm', 'publish', '.');
			}
		});
});

function bumpVersion() {
	return bump({
		type: 'patch'
	});
}
