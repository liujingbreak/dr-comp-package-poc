#!/usr/bin/env node

var _ = require('lodash');
var chalk = require('chalk');
var shell = require('shelljs');
var cli = require('shelljs-nodecli');
var fs = require('fs');
var Path = require('path');
var yargs = require('yargs');
var Promise = require('bluebird');
var buildUtils = require('../lib/gulp/buildUtils');
var os = require('os');
var argv = yargs.usage('Usage: $0 <command> [-d <target_folder>]')
	.command('init', 'Initialize environment, create gulpfile.js and other basic configuration')
	.command('update', 're-initialize environment, create gulpfile.js and other basic configuration, but don\'t copy examples')
	.command('install-deps', 'install gulp to local node_modules')
	.demand(1)
	.describe('d', 'set target directory')
	.alias('d', 'dir')
	.default('d', process.cwd(), 'current working directory')
	.help('h').alias('h', 'help')
	.epilog('copyright 2016')
	.argv;

var rootPath = Path.resolve(__dirname, '..');

if (argv._ && argv._[0]) {
	switch (argv._[0]) {
		case 'init':
			init();
			break;
		case 'update':
			init(true);
			break;
		case 'install-gulp':
			installDevDependencyAsync();
			break;
	}
}

function init(noExample) {
	_checkFolder();
	//var projectName = JSON.parse(fs.readFileSync(Path.join(__dirname, '..', 'package.json'), 'utf8')).name;
	var content = fs.readFileSync(Path.join(__dirname, 'gulpfile-template.js'), 'utf8');
	var relativePath = Path.relative(argv.d, rootPath);
	if (!_.startsWith(relativePath, '.')) {
		relativePath = './' + relativePath;
	}
	content = content.replace('<plateformFolder>', relativePath.replace(/\\/g, '/'));
	fs.writeFileSync(Path.join(argv.d, 'gulpfile.js'), content, 'utf8');

	if (!fileAccessable(Path.resolve(argv.d, 'config.yaml'))) {
		shell.cp(Path.resolve(__dirname, noExample ? 'config-template.yaml' : 'config-template-example.yaml'), argv.d + '/config.yaml');
	}
	if (!fileAccessable(Path.resolve(argv.d, 'config.local.yaml')))
		shell.cp(Path.resolve(__dirname, 'config.local-template.yaml'), argv.d + '/config.local.yaml');
	if (!fileAccessable(Path.resolve(argv.d, 'log4js.json')))
		shell.cp(Path.resolve(__dirname, '..', 'log4js.json'), argv.d + '/log4js.json');
	if (!fileAccessable(Path.resolve(argv.d, 'app.js')))
		shell.cp(Path.resolve(__dirname, 'app-template.js'), argv.d + '/app.js');
	if (!noExample) {
		shell.mkdir('-p', 'src/examples');
		shell.cp('-R', [
			Path.resolve(__dirname, 'examples', 'example-entry'),
			Path.resolve(__dirname, 'examples', 'i18n'),
			Path.resolve(__dirname, 'examples', 'example-node'),
		], argv.d + '/src/examples/');
		buildUtils.promisifyExe('npm', 'install', '--save',  '@dr/angularjs');
	}
	if (!fileAccessable(argv.d + '/.jscsrc')) {
		shell.cp(Path.resolve(__dirname, '..', '.jscsrc'), argv.d + '/');
		console.info('.jscsrc copied');
	}
	if (!fileAccessable(argv.d + '/.jshintrc')) {
		shell.cp(Path.resolve(__dirname, '..', '.jshintrc'), argv.d + '/');
		console.info('.jshintrc copied');
	}
	if (fileAccessable(Path.resolve('.git/hooks'))) {
		shell.cp('-f', Path.resolve(__dirname, 'git-hooks', '*'), argv.d + '/.git/hooks/');
		console.info('git hooks are copied');
		if (os.platform().indexOf('win32') <= 0) {
			shell.chmod('-R', '+x', argv.d + '/.git/hooks/*');
		}
	}

	if (!fileAccessable(Path.resolve('e2etest'))) {
		shell.mkdir('-p', argv.d + '/e2etest/spec');
		shell.mkdir('-p', argv.d + '/e2etest/pages');
		console.info('e2etest/spec End-to-end test directory is created');
	}

	if (!fileAccessable(Path.resolve('inject.js'))) {
		shell.cp('-f', Path.resolve(__dirname, 'inject-template.js'), argv.d + '/inject.js');
		console.info('inject.js is created');
	}
	if (!fileAccessable(Path.resolve('browserify-inject.js'))) {
		shell.cp('-f', Path.resolve(__dirname, 'inject-template.js'), argv.d + '/browserify-inject.js');
		console.info('browserify-inject.js is created');
	}

	// to solve npm 2.0 nested node_modules folder issue
	Promise.coroutine(function*() {
		yield installDevDependencyAsync();
		yield buildUtils.promisifyExe(Path.join('node_modules', '.bin', process.platform === 'win32' ? 'gulp.cmd' : 'gulp'), 'install-recipe');
		console.log(chalk.magenta('   -------------------------------------------------------'));
		console.log(chalk.magenta(' < Congrads! Remember, all your packages are belong to us! >'));
		console.log(chalk.magenta('   -------------------------------------------------------'));
		console.log(chalk.magenta('\t\\   ^__^\n\t \\  (oo)\\_______\n\t    (__)\\       )\\/\\\n\t        ||----w |\n\t        ||     ||'));
		console.log('Now you may run commands `npm install <package or recipe name>` `gulp compile` `node app.js`');
	})()
	.catch((err) => {
		if (err) {
			console.error(chalk.red(output));
		} else
			console.error(chalk.red('Failed to execute: node_modules/.bin/gulp install-recipe'));
	});
}

function _checkFolder() {
	if (!fs.existsSync('package.json')) {
		console.error(chalk.red('You need to create a package.json in this folder'));
		console.info('To create one, you may type command `npm init`');
		process.exit();
	}
}

function fileAccessable(file) {
	try {
		fs.accessSync(file, fs.R_OK);
		return true;
	} catch (e) {
		return false;
	}
}

function installDevDependencyAsync() {
	var devDeps = JSON.parse(fs.readFileSync(Path.resolve(__dirname + '/../package.json'), 'utf8')).devDependencies;
	var promise = Promise.resolve();
	_.forOwn(devDeps, (ver, name) => {
		if (fileAccessable(Path.resolve('node_modules/' + name))) {
			return;
		}
		console.log('npm install ' + name + '@' + ver);
		promise = promise.then(() => {
			return buildUtils.promisifyExe('npm', ['install', '--save-dev', name + '@' + ver]);
		}).catch(err => {
			throw new Error(err);
		});
	});
	return promise;
}
