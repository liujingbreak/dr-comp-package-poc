var gulp = require('gulp');
var Promise = require('bluebird');
var Path = require('path');
var gutil = require('gulp-util');
var jshint = require('gulp-jshint');
var jscs = require('gulp-jscs');
var bump = require('gulp-bump');
var through = require('through2');
var shell = require('shelljs');
// var watchify = require('watchify');
var del = require('del');
var jscs = require('gulp-jscs');
var vps = require('vinyl-paths');
var File = require('vinyl');
var Q = require('q');
Q.longStackSupport = true;
var _ = require('lodash');
var chalk = require('chalk');
var fs = require('fs');

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
	.command('publish', 'npm publish every pakages in source code folder including all mapped recipes')
	.command('bump', 'bump version number of all package.json, useful to call this before publishing packages')
	.command('flatten', 'flattern NPM v2 nodule_modules structure, install-recipe comamnd will execute this command')
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

var IS_NPM2 = _.startsWith(shell.exec('npm -v').output, '2.');

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
	var prom = Promise.resolve();
	if (config().dependencyMode) {
		prom = prom.then(function() {
			return installRecipe(config().internalRecipeFolderPath, true);
		});
	}
	recipeManager.eachRecipeSrc(function(src, recipeDir) {
		prom = prom.then(function() {
			return installRecipe(recipeDir);
		});
	});
	return prom.then(flatternNpm2Folder);
});

gulp.task('flatten', function() {
	return flatternNpm2Folder();
});

function flatternNpm2Folder() {
	var promises = [];
	if (!IS_NPM2) {
		return Promise.resolve();
	}
	gutil.log('NPM v2 needs flattern');
	recipeManager.eachInstalledRecipe(function(recipeDir) {
		var proms = new Promise(function(resolve, reject) {
			var recipeDepDir = Path.resolve('node_modules', recipeDir, 'node_modules');
			gutil.log('check recipe: ' + recipeDepDir);
			try {
				fs.accessSync(recipeDepDir, fs.R_OK);
				gutil.log('flatten recipe node_modules folder ' + recipeDir);
				shell.mv('node_modules/' + recipeDir + '/node_modules/*', 'node_modules/');
				fs.rmdirSync(recipeDepDir);
			} catch (err) {
			}
			var deps = JSON.parse(fs.readFileSync(Path.join(recipeDir, 'package.json'), 'utf8')).dependencies;
			_.forOwn(deps, function(ver, name) {
				try {
					var componentDef = Path.join('node_modules', name, 'node_modules');
					gutil.log('check package: ' + componentDef);
					fs.accessSync(componentDef, fs.R_OK);
					shell.mv('node_modules/' + name + '/node_modules/*', 'node_modules/');
					fs.rmdirSync(componentDef);
				} catch (err) {}
			});
			resolve();
		});
		promises.push(proms);
	});
	return Promise.all(promises);
}

function installRecipe(recipeDir, download) {
	return new Promise(function(resolve, reject) {
		if (IS_NPM2) {
			var deps = JSON.parse(fs.readFileSync(Path.join(recipeDir, 'package.json'), 'utf8')).dependencies;
			_.forOwn(deps, function(ver, name) {
				var parsedName = packageUtils.parseName(name);
				var target = download ? name : Path.join('node_modules', '@' + parsedName.scope, parsedName.name);

				cli.exec('npm', 'install', target, function(code, output) {
					if (code === 0) {
						resolve(code);
					} else {
						reject(output);
					}
				});
			});
		} else {
			gutil.log('install ' + recipeDir);
			cli.exec('npm', 'install', recipeDir, function(code, output) {
				if (code === 0) {
					resolve(code);
				} else {
					reject(output);
				}
			});
		}
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
			next();
		})).pipe(through.obj(function(file, enc, next) {
			file.base = config().rootPath;
			gutil.log('bump: ' + file.path);
			next(null, file);
		}))
		.pipe(bumpVersion())
		.pipe(gulp.dest(config().rootPath));

	return new Promise(function(resolve, reject) {
		stream.on('error', function(err) {
			reject(err);
		})
		.on('end', function() {
			gulp.start('link', function(err) {
				if (err) {
					return reject(err);
				}
				resolve();
			});
		});
	});
});

gulp.task('test-house', function() {
	var jasmine = new Jasmine();
	jasmine.loadConfigFile('spec/support/jasmine.json');
	jasmine.execute();
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
			gutil.log(paths);
			return new Promise(function(resolve, reject) {
				cli.exec('npm', 'publish', Path.dirname(paths), {silent: false},
					function(code, output) {
						resolve(code);
					});
			});
		})).on('end', function() {
			recipeManager.eachRecipeSrc(function(src, recipeDir) {
				cli.exec('npm', 'publish', recipeDir);
			});
			cli.exec('npm', 'publish', '.');
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
