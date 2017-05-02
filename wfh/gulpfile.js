//var nodeSearchPath = require('./lib/nodeSearchPath');
require('./bin/nodePath')();
var argv = require('./lib/gulp/showHelp');
var gulp = require('gulp');
var Promise = require('bluebird');
var Path = require('path');
var gutil = require('gulp-util');
var jshint = require('gulp-jshint');
var jscs = require('gulp-jscs');
var through = require('through2');
//var del = require('del');
var jscs = require('gulp-jscs');
var _ = require('lodash');
var chalk = require('chalk');
var fs = require('fs');
var runSequence = require('run-sequence');
//var es = require('event-stream');
//var buildUtils = require('./lib/gulp/buildUtils');

var buildUtils = require('./lib/gulp/buildUtils');

var packageLintableSrc = require('./lib/gulp/packageLintableSrc');
var watchPackages = require('./lib/gulp/watchPackages');
var recipeManager = require('./lib/gulp/recipeManager');
var packageUtils = require('./lib/packageMgr/packageUtils');

var config = require('./lib/config');
require('./lib/logConfig')(config().rootPath);
var cli = require('./lib/gulp/cli');

//var packageInstaller = PackageInstall();

//var IS_NPM2 = _.startsWith(shell.exec('npm -v').output, '2.');

gulp.task('default', function() {
	gutil.log('please individually execute with [command]');
});

gulp.task('init', function() {
	return cli.init();
});

gulp.task('install', function() {
	return cli.install();
});

gulp.task('project', function() {
	if (argv.a)
		return cli.addProject([].concat(argv.a));
	else
		return cli.listProject();
});

gulp.task('list-dep', function() {
	return require('./lib/gulp/cliAdvanced').listCompDependency(false);
});

gulp.task('clean', (cb) => {
	cli.clean();
});

// gulp.task('build', (cb)=> {
// 	_npmInstallCurrFolder()
// 	.then( ()=> {
// 		runSequence('install-recipe', 'compile', cb);
// 	});
// });

// gulp.task('build-prod', ['clean:dist'], (cb)=> {
// 	_npmInstallCurrFolder()
// 	.then( ()=> {
// 		config.disableLocal();
// 		runSequence('install-recipe', 'compile', cb);
// 	});
// });

gulp.task('compile-prod', (cb)=> {
	config.disableLocal();
	runSequence('compile', cb);
});

// function _npmInstallCurrFolder() {
// 	if (!config().dependencyMode) {
// 		// Use asynchronous `ShellJS.exec()` for long-lived process,
// 		// due to ShellJS's high CPU usage issue
// 		return buildUtils.promisifyExe('npm', 'install');
// 	} else {
// 		return Promise.resolve();
// 	}
// }

gulp.task('flatten-recipe', function() {
	//packageInstaller.flattenInstalledRecipes();
	gutil.log('flatten-recipe is obsolete');
});

gulp.task('lint', function() {
	var i = 0;
	return gulp.src(['lib/**/*.js', 'e2etest/**/*.js']
	.concat(packageLintableSrc(argv.p, argv.project)))
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

gulp.task('compile', function(cb) {
	cli.init()
	.then(() => {
		config.reload();
		runSequence('compile:dev', cb);
	});
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
		cli.bumpDirs([].concat(argv.d), argv.v);
		return cb();
	}
	if (argv.all == null && argv.pj == null) {
		console.log(`Usage:
	drcp bump -d <dir> [-d <dir> ...] [-v major|minor|patch]
	drcp bump --pj <project-dir> [-v major|minor|patch]
	drcp bump --all [-v major|minor|patch]`);
		return;
	}
	return cli.bumpProjects(argv.pj, argv.v);
});


gulp.task('publish', function(cb) {
	var promises = [];
	var count = 0;
	var Q = require('promise-queue');
	var q = new Q(5, Infinity);
	packageUtils.findAllPackages((name, entryPath, parsedName, json, packagePath) => {
		promises.push(
			q.add(() => {
				gutil.log('publish ' + json.name + '@' + json.version);
				return buildUtils.promisifyExe('npm', 'publish', packagePath, {silent: true});
			})
			.then(sucess).catch(handleExption)
		);
	}, 'src', argv.project);
	recipeManager.eachRecipeSrc(argv.project, function(src, recipeDir) {
		if (!recipeDir)
			return;
		var data = JSON.parse(fs.readFileSync(Path.join(recipeDir, 'package.json'), 'utf8'));
		promises.push(
			q.add(() => {
				gutil.log('publish ' + data.name + '@' + data.version);
				return buildUtils.promisifyExe('npm', 'publish', recipeDir, {silent: true});
			})
			.then(sucess)
			.catch(handleExption)
		);
	});
	Promise.all(promises)
	.catch(gutil.log)
	.finally(() => {
		gutil.log(count + ' published');
		cb();
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
	var promises = [];
	var count = 0;

	var Q = require('promise-queue');
	var q = new Q(5, Infinity);
	packageUtils.findAllPackages((name, entryPath, parsedName, json, packagePath) => {
		promises.push(
			q.add(()=> {
				gutil.log('unpublish ' + json.name + '@' + json.version);
				return buildUtils.promisifyExe('npm', 'unpublish', json.name + '@' + json.version);
			})
			.then(sucess).catch(()=>{})
		);
	}, 'src', argv.project);
	recipeManager.eachRecipeSrc(argv.project, function(src, recipeDir) {
		if (!recipeDir)
			return;
		promises.push(
			q.add(() => {
				var data = JSON.parse(fs.readFileSync(Path.join(recipeDir, 'package.json'), 'utf8'));
				gutil.log('unpublish ' + data.name + '@' + data.version);
				return buildUtils.promisifyExe('npm', 'unpublish', data.name + '@' + data.version);
			})
			.then(sucess).catch(()=>{})
		);
	});
	Promise.all(promises)
	.catch(()=>{})
	.finally(() => {
		gutil.log(count + ' unpublished');
		cb();
	});

	function sucess(m) {
		count++;
	}
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

gulp.task('ls', ['init'], function(callback) {
	config.reload();
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
