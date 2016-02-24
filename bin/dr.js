#!/usr/bin/env node

var _ = require('lodash');
var chalk = require('chalk');
var shell = require('shelljs');
var fs = require('fs');
var Path = require('path');
var yargs = require('yargs');
var argv = yargs.usage('Usage: $0 <command> [-d <target_folder>]')
	.command('init', 'Initialize environment, create gulpfile.js and other basic configuration')
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
	}
}

function init() {
	_checkFolder();
	var content = fs.readFileSync(Path.join(__dirname, 'gulpfile-template.js'), 'utf8');
	var relativePath = Path.relative(argv.d, rootPath);
	if (!_.startsWith(relativePath, '.')) {
		relativePath = './' + relativePath;
	}
	content = content.replace('<plateformFolder>', relativePath);
	fs.writeFileSync(Path.join(argv.d, 'gulpfile.js'), content, 'utf8');
	shell.cp(Path.resolve(__dirname, 'config-template.yaml'), argv.d + '/config.local.yaml');
	console.info('gulpfile.js, config.local.yaml copied');

	var recipeFile = Path.join(argv.d, 'package.json');
	if (!fs.existsSync(recipeFile)) {
		console.info('package.json doesn\'t exist, create a new one');

		fs.writeFileSync(recipeFile, JSON.stringify({
			name: '@dr/' + Path.basename(argv.d) + '-recipe',
			version: '0.0.0',
			description: 'package components list'
		}, null, '\t'), 'utf8');
	}
	if (!fs.existsSync(argv.d + '/.jscsrc')) {
		shell.cp(Path.resolve(__dirname, '..', '.jscsrc'), argv.d + '/');
		console.info('.jscsrc copied');
	}
	if (!fs.existsSync(argv.d + '/.jshintrc')) {
		shell.cp(Path.resolve(__dirname, '..', '.jshintrc'), argv.d + '/');
		console.info('.jshintrc copied');
	}
	shell.mkdir('src');
}

function _checkFolder() {
	if (fs.existsSync(Path.resolve(argv.d, 'gulpfile.js'))) {
		console.error(chalk.red('gulpfile.js already exists, please remove or rename it'));
		process.exit();
	}
	if (fs.existsSync(Path.resolve(argv.d, 'config.local.yaml'))) {
		console.error(chalk.red('config.local.yaml already exists, please remove or rename it'));
		process.exit();
	}
}
