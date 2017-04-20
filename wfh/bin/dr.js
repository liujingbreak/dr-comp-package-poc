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

