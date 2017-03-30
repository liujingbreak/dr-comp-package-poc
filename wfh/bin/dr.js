#!/usr/bin/env node
var Path = require('path');
var _ = require('lodash');
var chalk = require('chalk');
var yargs = require('yargs');
var buildUtils = require('../lib/gulp/buildUtils');


// Always print version information
printVersion()
.then(ver => {
	var argv = yargs.usage('Usage: $0 <command>')
		.command(['init', 'init-workspace'], 'Initialize workspace, copy project  and other basic configuration')
		.command(['update', 'u'], 'Re-initialize environment, create gulp script and other basic configuration, but don\'t copy examples')
		.command(['install', 'install-deps'], 'Install components and their dependency')
		.command(['add', 'a'], '<project-dir> Add project folder')
		.command(['clean'], 'Clean "destDir" and symbolic links from node_modules')
		.command(['list-dep'], 'List all component dependencies')
		.demand(1)
		.describe('root', 'workspace folder')
		.default('root', process.env.DR_ROOT_DIR || process.cwd())
		.help('h').alias('h', 'help')
		.epilog('copyright 2016')
		.global('root')
		.argv;

	var cli = require('./cli')(argv.root);

	try {
		if (argv._ && argv._[0]) {
			switch (argv._[0]) {
				case 'init':
				case 'init-workspace':
					cli.init();
					break;
				case 'update':
				case 'u':
					console.log('This command is deprecated');
					break;
				case 'install':
				case 'install-deps':
					cli.install();
					break;
				case 'add':
				case 'a':
					cli.addProject(argv._.slice(1));
					break;
				case 'clean':
					cli.clean();
					break;
				case 'list-dep':
					require('./cliHelper').listCompDependency(false);
					break;
				default:
					console.error('Unknown command "%s"', chalk.red(argv._[0]));
			}
		}
	} catch (err) {
		console.error(err);
	}
});

function printVersion() {
	console.log(_.padStart('Node version: %s', 30), chalk.blue(process.version));
	return buildUtils.getNpmVersion()
	.then(ver => {
		console.log(_.padStart('NPM version: %s', 30), chalk.blue(ver));
		console.log(_.padStart('dr-comp-package version: %s', 30), chalk.blue(getVersion()));
		return null;
	});
}

function getVersion() {
	var path = Path.dirname(__dirname);
	return require(Path.join(path, 'package.json')).version;
}

