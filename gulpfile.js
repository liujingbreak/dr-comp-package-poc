require('./lib/nodeSearchPath');
var gulp = require('gulp');
var Promise = require('bluebird');
var Path = require('path');
var gutil = require('gulp-util');
var jshint = require('gulp-jshint');
var jscs = require('gulp-jscs');
var bump = require('gulp-bump');
var through = require('through2');
var del = require('del');
var jscs = require('gulp-jscs');
var vps = require('vinyl-paths');
var File = require('vinyl');
var Q = require('q');
Q.longStackSupport = true;
var _ = require('lodash');
var chalk = require('chalk');
var fs = require('fs');
var runSequence = require('run-sequence');
//var buildUtils = require('./lib/gulp/buildUtils');

var cli = require('shelljs-nodecli');

var findPackageJson = require('./lib/gulp/findPackageJson');
var packageLintableSrc = require('./lib/gulp/packageLintableSrc');
var watchPackages = require('./lib/gulp/watchPackages');
var recipeManager = require('./lib/gulp/recipeManager');
var PackageInstall = require('./lib/gulp/packageInstallMgr');
var argv = require('yargs').usage('Usage: $0 <command> [-b <bundle>] [-p package]\n' +
	'$0 link [-r <recipe folder>] [-d <src folder>]')
	.command('build', 'build everything from scratch, including install-recipe, link, npm install, compile')
	.command('clean', 'cleanup build environment like dist/static folder, cache, recipe package.json, even those private modules in node_modules folder')
	.command('clean:dist', 'only cleanup dist/static folder, do not cleanup private packages in node_modules')
	.command('compile', 'link recipe, compile package into static browser bundles')
	.command('lint', 'source code style check')
	.command('install-recipe', 'link newly changed package.json files to recipe folder and `npm install` them, this makes sure all dependencies being installed')
	.command('watch', 'automatically rebuild specific bundle file when changes on browser packages source code is detected, if you change any package.json or add/remove packages, you need to restart watch command')
	.command('link', 'link newly changed package.json files to recipe folder')
	.command('build-prod', 'disable config.local.yaml, build for production environment')
	.command('publish', 'npm publish every pakages in source code folder including all mapped recipes')
	.command('unpublish', 'npm unpublish every pakages in source code folder including all mapped recipes of version number in current source code')
	.command('bump', '[-v major|minor|patch|prerelease] bump version number of all package.json, useful to call this before publishing packages, default is increasing patch number by 1')
	.command('flatten-recipe', 'flattern NPM v2 nodule_modules structure, install-recipe comamnd will execute this command')
	.command('test', '[-p <package-short-name>] [-f <spec-file-path>] run Jasmine for specific or all packages')
	.command('e2e', '[-d <test-suit-dir] [-f <spec-file-path>] [--browser <chrome|firefox|ie|opera|edge|safari>]run Jasmine for end-to-end tests')
	.describe('b', '<bundle-name> if used with command `compile` or `build`, it will only compile specific bundle, which is more efficient')
	.alias('b', 'bundle')
	.describe('p', '<package-short-name> if used with command `compile`, `build`, `lint`, it will only build and check style on specific package, which is more efficient')
	.alias('p', 'package')
	.describe('only-js', 'only rebuild JS bundles')
	.describe('only-css', 'only rebuild CSS bundles')
	.describe('d', '<src foldr> if used with command `link`, it will link packages from specific folder instead of `srcDir` configured in config.yaml')
	.describe('r', '<recipe foldr> if used with command `link`, it will link packages only to specific recipe folder instead of `recipeFolder` configured in config.yaml')
	.describe('v', 'major | minor | patch | prerelease, used with `bump`')
	.describe('f', '<file-path> command `gulp test -f specFile1 [-f specFile2] ...`')
	.alias('f', 'file')
	.describe('browser', 'Used with command `e2e`')
	.choices('browser', ['firefox', 'chrome', 'ie', 'safari', 'opera'])
	.demand(1)
	.help('h').alias('h', 'help')
	.argv;

var config = require('./lib/config');
require('log4js').configure(Path.join(__dirname, 'log4js.json'));

var packageInstaller = PackageInstall();

//var IS_NPM2 = _.startsWith(shell.exec('npm -v').output, '2.');

gulp.task('default', function() {
	gutil.log('please individually execute gulp [task]');
	gutil.log('\tbuild clean, link, compile [-b <bundle> ...], bump, publish');
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

gulp.task('build', (cb)=> {
	_npmInstallCurrFolder()
	.then( ()=> {
		runSequence('install-recipe', 'compile', cb);
	});
});

gulp.task('build-prod', ['clean:dist'], (cb)=> {
	_npmInstallCurrFolder()
	.then( ()=> {
		config.disableLocal();
		runSequence('install-recipe', 'compile', cb);
	});
});

gulp.task('compile-prod', (cb)=> {
	config.disableLocal();
	runSequence('compile', cb);
});

function _npmInstallCurrFolder() {
	return new Promise(function(resolve, reject) {
		if (!config().dependencyMode) {
			// Use asynchronous `ShellJS.exec()` for long-lived process,
			// due to ShellJS's high CPU usage issue
			cli.exec('npm', 'install', function(code, output) {
				if (code === 0) {
					resolve();
				} else {
					reject(output);
				}
			});
		} else {
			resolve();
		}
	});
}

gulp.task('install-recipe', ['link'], function(cb) {
	//var lookingForDeps = configuredVendors();
	var prom = Promise.resolve();
	if (config().dependencyMode) {
		prom = prom
		.then(function() {
			var currPkJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
			var savedVer = currPkJson.dependencies ? currPkJson.dependencies['@dr/internal-recipe'] :
				(currPkJson.devDependencies ? currPkJson.devDependencies['@dr/internal-recipe'] : false);
			if (savedVer) {
				return packageInstaller.installRecipeAsync('@dr/internal-recipe@' + savedVer);
			} else {
				return packageInstaller.installRecipeAsync(config().internalRecipeFolderPath);
			}
		});
	}

	prom = prom.then(() => {
		return new Promise((resolve, reject) => {
			process.nextTick(() => {
				// Put it in process.nextTick to hopefully solve a windows install random 'EPERM' error.
				flattenRecipe();
				resolve();
			});
		});
	});

	var srcDirs = [];
	recipeManager.eachRecipeSrc(function(src, recipe) {
		srcDirs.push(src);
	});
	prom = prom.then(()=> {
		return packageInstaller.scanSrcDepsAsync(srcDirs);
	}).then( () => {
		return packageInstaller.installDependsAsync();
	}).then(() => cb());
});

gulp.task('flatten-recipe', flattenRecipe);

function flattenRecipe() {
	packageInstaller.flattenInstalledRecipes();
	return null;
}

gulp.task('check-dep', function() {
	var mgr = new PackageInstall();
	var srcDirs = [];
	recipeManager.eachRecipeSrc(function(src, recipe) {
		srcDirs.push(src);
	});
	mgr.scanSrcDepsAsync(srcDirs)
	.then(_.bind(mgr.printDep, mgr));
});

gulp.task('lint', function() {
	var i = 0;
	return gulp.src(['*.js', 'lib/**/*.js', 'e2etest/**/*.js']
	.concat(packageLintableSrc(argv.p)))
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

gulp.task('compile', ['link', 'flatten-recipe'], function(cb) {
	runSequence('compile:dev', cb);
});

gulp.task('compile:dev', function(cb) {
	require('./lib/packageMgr/packageCompiler')(argv)
	.then(() => {cb();})
	.catch( e => { cb('failed'); });
});

gulp.task('watch', function() {
	watchPackages(argv.p, argv);
});
/**
 * TODO: bump dependencies version
 */
gulp.task('bump', function(cb) {
	var srcDirs = [];
	var recipes = [];
	recipeManager.eachRecipeSrc(function(src, recipe) {
		srcDirs.push(src);
		recipes.push(recipe);
	});
	var stream = gulp.src(srcDirs)
		.pipe(findPackageJson())
		.pipe(through.obj(function(file, enc, next) {
			file.contents = new Buffer(fs.readFileSync(file.path, 'utf8'));
			next(null, file);
		}, function(next) {
			var self = this;
			recipes.forEach(function(recipe) {
				self.push(new File({
					base: config().rootPath,
					path: Path.resolve(recipe, 'package.json'),
					contents: new Buffer(fs.readFileSync(Path.resolve(recipe, 'package.json'), 'utf8'))
				}));
			});

			var packageJsonPath = Path.resolve(config().rootPath, 'package.json');
			this.push(new File({
				base: config().rootPath,
				path: packageJsonPath,
				contents: new Buffer(fs.readFileSync(packageJsonPath, 'utf8'))
			}));
			next();
		})).pipe(through.obj(function(file, enc, next) {
			file.base = config().rootPath;
			gutil.log('bump: ' + file.path);
			next(null, file);
		}))
		.pipe(bumpVersion())
		.pipe(gulp.dest(config().rootPath));

	stream.on('error', function(err) {
		cb(err);
	})
	.on('end', function() {
		runSequence('link', function(err) {
			if (err) {
				return cb(err);
			}
			cb();
		});
	});
});


gulp.task('publish', function() {
	var srcDirs = [];
	recipeManager.eachRecipeSrc(function(src, recipe) {
		srcDirs.push(src);
	});
	return gulp.src(srcDirs)
		.pipe(findPackageJson())
		.on('error', gutil.log)
		.pipe(vps(function(paths) {
			var data = JSON.parse(fs.readFileSync(paths, 'utf8'));
			gutil.log('publish ' + data.name + '@' + data.version);
			return new Promise(function(resolve, reject) {
				cli.exec('npm', 'publish', Path.dirname(paths), {silent: true},
					function(code, output) {
						resolve(code);
					});
			});
		})).on('end', function() {
			recipeManager.eachRecipeSrc(function(src, recipeDir) {
				var data = JSON.parse(fs.readFileSync(Path.join(recipeDir, 'package.json'), 'utf8'));
				gutil.log('publish ' + data.name + '@' + data.version);
				cli.exec('npm', 'publish', recipeDir, {silent: true});
			});
			var data = JSON.parse(fs.readFileSync('package.json', 'utf8'));
			gutil.log('publish ' + data.name + '@' + data.version);
			cli.exec('npm', 'publish', process.cwd(), {silent: true});
		});
});

gulp.task('unpublish', function() {
	var srcDirs = [];
	recipeManager.eachRecipeSrc(function(src, recipe) {
		srcDirs.push(src);
	});
	return gulp.src(srcDirs)
		.pipe(findPackageJson())
		.on('error', gutil.log)
		.pipe(vps(function(paths) {
			var data = JSON.parse(fs.readFileSync(paths, 'utf8'));
			gutil.log('unpublish ' + data.name + '@' + data.version);
			return new Promise(function(resolve, reject) {
				cli.exec('npm', 'unpublish', data.name + '@' + data.version, {silent: false},
					function(code, output) {
						resolve(code);
					});
			});
		})).on('end', function() {
			recipeManager.eachRecipeSrc(function(src, recipeDir) {
				var data = JSON.parse(fs.readFileSync(Path.join(recipeDir, 'package.json'), 'utf8'));
				gutil.log('unpublish ' + data.name + '@' + data.version);
				cli.exec('npm', 'unpublish', data.name + '@' + data.version, {silent: false});
			});
			var data = JSON.parse(fs.readFileSync('package.json', 'utf8'));
			gutil.log('unpublish ' + data.name + '@' + data.version);
			cli.exec('npm', 'unpublish', data.name + '@' + data.version, {silent: false});
		});
});

gulp.task('test', function(callback) {
	return require('./lib/gulp/testRunner').runUnitTest(argv)
	.then(()=> { callback(); })
	.catch(e => { callback('Test failed'); });
});

gulp.task('e2e', function(callback) {
	require('./lib/gulp/testRunner').runE2eTest(argv)
	.then(()=> { callback(); })
	.catch(e => { callback('Test failed'); });
});


function bumpVersion() {
	var type = 'patch';
	if (argv.v) {
		if (!{major: 1, minor: 1, patch: 1, prerelease: 1}.hasOwnProperty(argv.v)) {
			gutil.log(chalk.red('expecting bump type is one of "major|minor|patch|prerelease", but get: ' + argv.v));
			throw new Error('Invalid -v parameter');
		}
		type = argv.v;
	}
	return bump({
		type: type
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
