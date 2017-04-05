#!/usr/bin/env node
var Path = require('path');
var _ = require('lodash');
var chalk = require('chalk');
var buildUtils = require('../lib/gulp/buildUtils');


// Always print version information
printVersion()
.then(ver => {
	try {
		require('../lib/gulp/cli').initGulpfile();
		require('gulp/bin/gulp');
		// if (argv._ && argv._[0]) {
		// 	switch (argv._[0]) {
		// 		case 'init':
		// 		case 'init-workspace':
		// 			cli.init();
		// 			break;
		// 		case 'update':
		// 		case 'u':
		// 			console.log('This command is deprecated');
		// 			break;
		// 		case 'install':
		// 		case 'install-deps':
		// 			cli.install();
		// 			break;
		// 		case 'add':
		// 		case 'a':
		// 			cli.addProject(argv._.slice(1));
		// 			break;
		// 		case 'clean':
		// 			cli.clean();
		// 			break;
		// 		case 'list-dep':
		// 			require('./cliAdvanced').listCompDependency(false);
		// 			break;
		// 		default:
		// 			//console.error('Unknown command "%s"', chalk.red(argv._[0]));
		// 			require('gulp/bin/gulp');
		// 	}
		// }
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

