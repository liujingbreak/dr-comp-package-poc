//var nodeSearchPath = require('./lib/nodeSearchPath');
require('./bin/nodePath')();
var argv = require('./lib/gulp/showHelp')(require('yargs'));
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
var File = require('vinyl');
var _ = require('lodash');
var chalk = require('chalk');
var fs = require('fs');
var runSequence = require('run-sequence');
//var buildUtils = require('./lib/gulp/buildUtils');

var buildUtils = require('./lib/gulp/buildUtils');

var findPackageJson = require('./lib/gulp/findPackageJson');
var packageLintableSrc = require('./lib/gulp/packageLintableSrc');
var watchPackages = require('./lib/gulp/watchPackages');
var recipeManager = require('./lib/gulp/recipeManager');
var PackageInstall = require('./lib/gulp/packageInstallMgr');

var config = require('./lib/config');
require('./lib/logConfig')(config().rootPath);

//var packageInstaller = PackageInstall();

//var IS_NPM2 = _.startsWith(shell.exec('npm -v').output, '2.');

gulp.task('default', function() {
	gutil.log('please individually execute gulp [task]');
	gutil.log('\tbuild clean, link, compile [-b <bundle> ...], bump, publish');
});

gulp.task('clean:installed', function() {
	var dirs = [];
	_.each(config().packageScopes, function(packageScope) {
		var npmFolder = Path.resolve('node_modules', '@' + packageScope);
		gutil.log('delete ' + npmFolder);
		dirs.push(npmFolder);
	});
	return del(dirs).then(gutil.log, gutil.log);
});

gulp.task('clean:recipe', function() {
	return recipeManager.clean();
});

gulp.task('clean:dist', function() {
	return del([config().staticDir, config().destDir]);
});

gulp.task('clean', (cb) => {
	runSequence('clean:recipe', 'clean:dist', cb);
});

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
	if (!config().dependencyMode) {
		// Use asynchronous `ShellJS.exec()` for long-lived process,
		// due to ShellJS's high CPU usage issue
		return buildUtils.promisifyExe('npm', 'install');
	} else {
		return Promise.resolve();
	}
}

// gulp.task('install-recipe', ['link'], function(cb) {
// 	//var lookingForDeps = configuredVendors();
// 	Promise.coroutine(function*() {
// 		if (config().dependencyMode) {
// 			var currPkJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
// 			var savedVer = currPkJson.dependencies ? currPkJson.dependencies['@dr/internal-recipe'] :
// 				(currPkJson.devDependencies ? currPkJson.devDependencies['@dr/internal-recipe'] : false);
// 			if (savedVer) {
// 				yield packageInstaller.installRecipeAsync('@dr/internal-recipe@' + savedVer);
// 			} else {
// 				yield packageInstaller.installRecipeAsync(config().internalRecipeFolderPath);
// 			}
// 		}

// 		yield new Promise((resolve, reject) => {
// 			process.nextTick(() => {
// 				// Put it in process.nextTick to hopefully solve a windows install random 'EPERM' error.
// 				packageInstaller.flattenInstalledRecipes();
// 				resolve();
// 			});
// 		});

// 		var srcDirs = [];
// 		recipeManager.eachRecipeSrc(function(src, recipe) {
// 			srcDirs.push(src);
// 		});
// 		yield Promise.all([
// 			packageInstaller.scanSrcDepsAsync(srcDirs),
// 			buildUtils.npmMajorVersion()
// 		]);
// 		yield packageInstaller.installDependsAsync();
// 		cb();
// 	})()
// 	.catch(e => {
// 		cb(e);
// 	});
// });

gulp.task('flatten-recipe', function() {
	//packageInstaller.flattenInstalledRecipes();
	gutil.log('flatten-recipe is obsolete');
});

gulp.task('check-dep', function() {
	var mgr = new PackageInstall();
	var srcDirs = [];
	recipeManager.eachRecipeSrc(function(src, recipe) {
		srcDirs.push(src);
	});
	mgr.scanSrcDepsAsync(srcDirs)
	.then(_.bind(mgr.printComponentDep, mgr));
});

gulp.task('lint', function() {
	var i = 0;
	return gulp.src(['lib/**/*.js', 'e2etest/**/*.js']
	.concat(packageLintableSrc(argv.p)))
	.pipe(jshint())
	.pipe(jshint.reporter('jshint-stylish'))
	.pipe(jshint.reporter('fail'))
	.pipe(through.obj(function(file, en, next) {
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

gulp.task('compile', function(cb) {
	runSequence(['link', 'flatten-recipe'], 'compile:dev', cb);
});

gulp.task('compile:dev', function(cb) {
	require('./lib/packageMgr/packageRunner').runBuilder(argv)
	.then(cb)
	.catch( e => {
		cb('compile:dev faile: ' + e.stack);
		//process.nextTick(()=> process.exit(1));
	});
});

gulp.task('watch', function() {
	watchPackages(argv.p, argv);
});
/**
 * TODO: bump dependencies version
 */
gulp.task('bump', function(cb) {
	if (argv.d) {
		bumpDirs([].concat(argv.d));
		return cb();
	}
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
		}))
		.pipe(through.obj(function(file, enc, next) {
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


gulp.task('publish', function(cb) {
	var srcDirs = [];
	recipeManager.eachRecipeSrc(function(src, recipe) {
		srcDirs.push(src);
	});
	var promises = [];
	var count = 0;

	var data = JSON.parse(fs.readFileSync('package.json', 'utf8'));
	gutil.log('publish ' + data.name + '@' + data.version);
	promises.push(buildUtils.promisifyExe('npm', 'publish', '.', {silent: true})
		.then(sucess).catch(handleExption));

	gulp.src(srcDirs)
		.pipe(findPackageJson())
		.on('error', gutil.log)
		.on('data', file => {
			var data = JSON.parse(fs.readFileSync(file.path, 'utf8'));
			gutil.log('publish ' + data.name + '@' + data.version);
			promises.push( buildUtils.promisifyExe('npm', 'publish', Path.dirname(file.path), {silent: true})
				.then(sucess).catch(handleExption));
		})
		.on('end', ()=> {
			recipeManager.eachRecipeSrc(function(src, recipeDir) {
				var data = JSON.parse(fs.readFileSync(Path.join(recipeDir, 'package.json'), 'utf8'));
				gutil.log('publish ' + data.name + '@' + data.version);
				promises.push( buildUtils.promisifyExe('npm', 'publish', recipeDir, {silent: true})
						.then(sucess).catch(handleExption));
			});

			Promise.all(promises)
			.catch(gutil.log)
			.finally(() => {
				gutil.log(count + ' published');
				cb();
			});
		});

	function sucess(m) {
		count++;
		gutil.log(m);
	}

	function handleExption(e) {
		//log.warn(e);
	}
});

gulp.task('unpublish', function(cb) {
	var srcDirs = [];
	var promises = [];
	recipeManager.eachRecipeSrc(function(src, recipe) {
		srcDirs.push(src);
	});
	// var origOutMaxNum = process.stdout.getMaxListeners();
	// var origErrMaxNum = process.stderr.getMaxListeners();
	// process.stderr.setMaxListeners(9999);
	// process.stdout.setMaxListeners(9999);

	gulp.src(srcDirs)
		.pipe(findPackageJson())
		.on('error', gutil.log)
		.on('data', file => {
			var data = JSON.parse(fs.readFileSync(file.path, 'utf8'));
			gutil.log('unpublish src ' + data.name + '@' + data.version);
			promises.push(buildUtils.promisifyExe('npm', 'unpublish', data.name + '@' + data.version).catch(()=>{}));
		})
		.on('end', ()=> {
			recipeManager.eachRecipeSrc(function(src, recipeDir) {
				var data = JSON.parse(fs.readFileSync(Path.join(recipeDir, 'package.json'), 'utf8'));
				gutil.log('unpublish recipe ' + data.name + '@' + data.version);
				promises.push(buildUtils.promisifyExe('npm', 'unpublish', data.name + '@' + data.version).catch(()=>{}));
			});
			var data = JSON.parse(fs.readFileSync('package.json', 'utf8'));
			gutil.log('unpublish ' + data.name + '@' + data.version);
			promises.push(buildUtils.promisifyExe('npm', 'unpublish', data.name + '@' + data.version).catch(()=>{}));
			Promise.all(promises)
			.catch(()=>{})
			.finally(() => {
				// process.stderr.setMaxListeners(origErrMaxNum);
				// process.stdout.setMaxListeners(origOutMaxNum);
				process.nextTick(cb);
			});
		});
});

gulp.task('test', function(callback) {
	require('./lib/gulp/testRunner').runUnitTest(argv)
	.then(()=> {
		callback();
	})
	.catch(e => {
		if (e)
			gutil.log(e.stack || e);
		callback('Test failed');
	});
});

gulp.task('e2e', function(callback) {
	require('./lib/gulp/testRunner').runE2eTest(argv)
	.then(()=> { callback(); })
	.catch(e => {
		if (e)
			gutil.log(e.stack || e);
		callback('Test failed');
	});
});

gulp.task('ls', ['link'], function(callback) {
	require('log4js').getLogger('lib.injector').setLevel('warn');
	require('log4js').getLogger('packagePriorityHelper').setLevel('warn');
	var rj = require('./lib/injectorFactory');
	var injector = rj(require.resolve);
	injector.fromPackage('@dr-core/build-util')
	.factory('__api', function() {
		return {compileNodePath: [config().nodePath]};
	});

	Promise.coroutine(function*() {
		var browserCompInfo = require('@dr-core/build-util').walkPackages.listBundleInfo(
			config, argv, require('./lib/packageMgr/packageUtils'), [Path.join(config().rootPath, 'node_modules')]);
		console.log(chalk.green(_.pad('[ BROWSER COMPONENTS ]', 50, '=')));
		var index = 0;
		var sorted = browserCompInfo.allModules.slice(0).sort((a, b) => b.longName.length - a.longName.length);
		var maxNameLen = sorted[0].longName.length;

		_.each(browserCompInfo.bundleMap, (packages, bundle) => {
			console.log(chalk.cyan('Webpack chunk ' + _.pad(' ' + bundle + ' ', 50, '-')));
			_.each(packages, pk => {
				if (pk.isOtherEntry)
					return;
				var path = pk.realPackagePath ? pk.realPackagePath : pk.packagePath;
				console.log(' ' + (++index) + '. ' + _.padEnd(pk.longName, maxNameLen + 3) +
					(path ? '(' + Path.relative(config().rootPath, path) + ')' : ''));
			});
		});

		if (_.size(browserCompInfo.noChunkPackageMap) > 0) {
			console.log('No bundle setting packages: ');
			_.each(browserCompInfo.noChunkPackageMap, pk => {
				if (pk.isOtherEntry)
					return;
				var path = pk.realPackagePath ? pk.realPackagePath : pk.packagePath;
				console.log(' ' + (++index) + '. ' + _.padEnd(pk.longName, maxNameLen + 3) +
					(path ? '(' + Path.relative(config().rootPath, path) + ')' : ''));
			});
		}

		console.log('\n' + chalk.green(_.pad('[ SERVER COMPONENTS ]', 50, '=')) + '\n');
		var list = yield require('./lib/packageMgr/packageRunner').listServerComponents();
		list.forEach(row => console.log(' ' + row.desc + '   (' + Path.relative(config().rootPath, row.pk.path) + ')'));
		console.log('');
		console.log('\n' + chalk.green(_.pad('[ BUILDER COMPONENTS ]', 50, '=')) + '\n');
		list = yield require('./lib/packageMgr/packageRunner').listBuilderComponents();
		list.forEach(row => console.log(' ' + row.desc + '   (' + Path.relative(config().rootPath, row.pk.path) + ')'));
		callback();
	})()
	.catch(e => callback(e));
});

function bumpDirs(dirs) {
	var stream = gulp.src('')
	.pipe(through.obj(function(file, enc, next) {next();},
		function(next) {
			for (var d of dirs) {
				gutil.log(d);
				var packageJsonPath = Path.resolve(d, 'package.json');
				this.push(new File({
					base: Path.resolve(),
					path: packageJsonPath,
					contents: new Buffer(fs.readFileSync(packageJsonPath, 'utf8'))
				}));
			}
			next();
		}))
	.pipe(bumpVersion())
	.pipe(gulp.dest(Path.resolve()));
	return stream;
}

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

gulp.task('t', function(cb) {
	buildUtils.promisifyExe('ls', '-ls')
	.catch(()=>{})
	.finally(() => {
		setTimeout(cb, 1);
		//cb();
	});
});

uncaughtException();
function uncaughtException() {
	process.removeAllListeners('uncaughtException');
	process.on('uncaughtException', function(err) {
		// handle the error safely
		gutil.log(chalk.red('Uncaught exception: '), err, err.stack);
		throw err;
	});
}
