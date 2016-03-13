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
var chalk = require('chalk');

var cli = require('shelljs-nodecli');
var Jasmine = require('jasmine');

var findPackageJson = require('./lib/gulp/findPackageJson');
var packageLintableSrc = require('./lib/gulp/packageLintableSrc');
var packageUtils = require('./lib/packageMgr/packageUtils');
var watchPackages = require('./lib/gulp/watchPackages');
var recipeManager = require('./lib/gulp/recipeManager');
var argv = require('yargs').usage('Usage: $0 <command> [-b <bundle>] [-p package]\n' +
	'$0 link [-r <recipe folder>] [-d <src folder>]')
	.command('build', 'build everything from scratch, including install-recipe, link, npm install, compile')
	.command('clean', 'cleanup build environment like dist folder, cache, recipe package.json, even those private modules in node_modules folder')
	.command('compile', 'compile static stuff like JS, less file into bundles, build command calls this command, depends on `gulp link`')
	.command('lint', 'source code style check')
	.command('install-recipe', 'link newly changed package.json files to recipe folder and `npm install` them, this makes sure all dependencies being installed')
	.command('watch', 'automatically rebuild specific bundle file when changes on browser packages source code is detected, if you change any package.json or add/remove packages, you need to restart watch command')
	.command('link', 'link newly changed package.json files to recipe folder')
	.describe('b', '<bundle-name> if used with command `compile` or `build`, it will only compile specific bundle, which is more efficient')
	.alias('b', 'bundle')
	.describe('p', '<package-short-name> if used with command `compile`, `build`, `lint`, it will only build and check style on specific package, which is more efficient')
	.alias('p', 'package')
	//.describe('only-js', 'only rebuild JS bundles')
	.describe('only-css', 'only rebuild CSS bundles')
	.describe('d', '<src foldr> if used with command `link`, it will link packages from specific folder instead of `srcDir` configured in config.yaml')
	.describe('r', '<recipe foldr> if used with command `link`, it will link packages only to specific recipe folder instead of `recipeFolder` configured in config.yaml')
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

gulp.task('clean:recipe', function() {
	recipeManager.clean();
});

gulp.task('clean:dist', function() {
	return del([config().staticDir, config().destDir]);
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
	recipeManager.eachRecipe(function(src, recipeDir) {
		promises.push(installRecipe(recipeDir));
	});
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
	var i = 0;
	return gulp.src(['*.js', 'lib/**/*.js']
	.concat(packageLintableSrc(packageUtils.findAllPackages, argv.p)))
	.pipe(jshint())
	.pipe(jshint.reporter('jshint-stylish'))
	.pipe(jshint.reporter('fail'))
	.pipe(require('through2').obj(function(file, en, next) {
		gutil.log(++i + ' ' + file.path);
		next(null, file);
	}))
	.pipe(jscs())
	.pipe(jscs.reporter())
	.pipe(jscs.reporter('fail'));
});

/**
 * link src/ ** /package.json from node_modules folder
 */
gulp.task('link', function() {
	return recipeManager.link();
});

gulp.task('compile', function() {
	return require('./lib/packageMgr/packageCompiler')(argv);
});

gulp.task('watch', function() {
	watchPackages(argv.p, argv);
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
	var srcDirs = [];
	recipeManager.eachRecipe(function(src, recipe) {
		srcDirs.push(src);
	});
	return gulp.src(srcDirs)
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

uncaughtException();
function uncaughtException() {
	process.removeAllListeners('uncaughtException');
	process.on('uncaughtException', function(err) {
		// handle the error safely
		gutil.log(chalk.red('Uncaught exception: '), err, err.stack);
	});
}
