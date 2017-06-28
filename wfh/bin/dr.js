#!/usr/bin/env node
var Path = require('path');
var fs = require('fs');
var os = require('os');
var processUtils = require('../lib/gulp/processUtils');

const INTERNAL_RECIPE_VER = '^0.3.43';
var drcpPkJson = require('../package.json');
const DRCP_NAME = drcpPkJson.name;

if (fs.lstatSync(Path.resolve('node_modules', DRCP_NAME)).isSymbolicLink()) {
	console.log(`dr-comp-packag is a symlink, checking ${DRCP_NAME}'s dependencies`);
	installDeps(true)
	.then(()=> {
		require('../lib/gulp/cli').writeProjectListFile([Path.resolve(__dirname, '..', '..')]);
	})
	.then(() => processCmd());
} else {
	installDeps(false).then(() => processCmd());
}

function installDeps(isDrcpDevMode) {
	if (ensurePackageJsonFile(isDrcpDevMode))
		return processUtils.promisifyExe('yarn', 'install', {cwd: process.cwd()});
	return Promise.resolve();
}

/**
 * @param {*} isDrcpDevMode denote true to copy dr-comp-package dependency list to workspace package.json file
 * @return true if workspace package.json file is changed
 */
function ensurePackageJsonFile(isDrcpDevMode) {
	var workspaceJson;
	var needInstall = false;
	if (!fs.existsSync('package.json')) {
		console.log('Creating package.json');
		workspaceJson = JSON.parse(fs.readFileSync(
			Path.resolve(__dirname, './package.json.template'), 'utf8'));
		workspaceJson.author = os.userInfo().username;
		workspaceJson.name = Path.basename(process.cwd());
		workspaceJson.description = '@dr web component platform workspace';
		needInstall = true;
	} else {
		workspaceJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
	}
	if (!workspaceJson.dependencies)
		workspaceJson.dependencies = {};
	if (isDrcpDevMode) {
		delete workspaceJson.dependencies[DRCP_NAME];
		delete workspaceJson.dependencies['@dr/internal-recipe'];
		if (workspaceJson.devDependencies) {
			delete workspaceJson.devDependencies[DRCP_NAME];
			delete workspaceJson.devDependencies['@dr/internal-recipe'];
		}
		var drcpDeps = drcpPkJson.dependencies;
		for (let name in drcpDeps) {
			if (Object.prototype.hasOwnProperty.call(drcpDeps, name) &&
			workspaceJson.dependencies[name] == null) {
				needInstall = true;
				workspaceJson.dependencies[name] = drcpDeps[name];
				console.log(` + ${name} ${drcpDeps[name]}`);
			}
		}
	} else {
		if (workspaceJson.dependencies['@dr/internal-recipe'] == null) {
			workspaceJson.dependencies['@dr/internal-recipe'] = INTERNAL_RECIPE_VER;
			needInstall = true;
		}
	}
	if (needInstall) {
		fs.writeFileSync('package.json', JSON.stringify(workspaceJson, null, '  '));
		console.log('Writing package.json');
		return true;
	}
	return false;
}

function processCmd() {
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
}


