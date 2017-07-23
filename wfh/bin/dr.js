#!/usr/bin/env node
var Path = require('path');
var fs = require('fs');
var os = require('os');
var processUtils = require('../lib/gulp/processUtils');

const INTERNAL_RECIPE_VER = '0.3.56';
var drcpPkJson = require('../package.json');
const DRCP_NAME = drcpPkJson.name;
const _has = Object.prototype.hasOwnProperty;

process.env.SASS_BINARY_SITE = 'https://npm.taobao.org/mirrors/node-sass';

var versionsFromCache = false;
var cacheFile = Path.resolve(os.tmpdir(), 'drcpLatestVersion.json');
var cachedVersionsInfo = readCachedVersionInfo();

var cmdPromise;
if (fs.lstatSync(Path.resolve('node_modules', DRCP_NAME)).isSymbolicLink()) {
	console.log(`dr-comp-packag is a symlink, checking ${DRCP_NAME}'s dependencies`);
	cmdPromise = installDeps(true)
	.then(latestRecipe => checkVersions(latestRecipe))
	.then(()=> {
		require('../lib/gulp/cli').writeProjectListFile([Path.resolve(__dirname, '..', '..')]);
	})
	.then(() => processCmd());
} else {
	cmdPromise = installDeps(false)
	.then(latestRecipe => checkVersions(latestRecipe))
	.then(() => processCmd())
	.catch(e => console.error(e));
}
cmdPromise.catch(e => {
	console.error(e);
	process.exit(1);
});

function installDeps(isDrcpDevMode) {
	return getLatestRecipeVer()
	.then(latestRecipe => {
		if (ensurePackageJsonFile(isDrcpDevMode, latestRecipe))
			return processUtils.promisifyExe('yarn', 'install', {cwd: process.cwd()});
		return latestRecipe;
	});
}

var npmViewReg = /latest:\s*['"]([^"']+)['"]/;
function checkVersions(latestRecipe) {
	var chalk = require('chalk'); // do not require any 3rd-party util installDeps() is done
	var _ = require('lodash');
	var buildUtils = require('../lib/gulp/buildUtils');
	var osLocale = require('os-locale');
	var semver = require('semver');
	const PAD_SPACE = 35;

	return Promise.all([buildUtils.getNpmVersion(), getLatestDrcpVer(), osLocale()])
	.then(outputs => {
		console.log(_.repeat('-', 50));
		var drcpVer = getVersion();
		var recipeVer = getRecipeVersion();
		console.log(_.padStart('Node version: %s', PAD_SPACE), chalk.green(process.version));
		console.log(_.padStart('NPM version: %s', PAD_SPACE), chalk.green(outputs[0]));
		console.log(_.padStart('dr-comp-package version: %s', PAD_SPACE), chalk.green(drcpVer));
		if (recipeVer)
			console.log(_.padStart('@dr/internal-recipe version: %s', PAD_SPACE), chalk.green(recipeVer));
		var latestDrcp = outputs[1];

		if (latestDrcp && semver.gt(latestDrcp, drcpVer)) {
			console.log(_.padStart('Latest dr-comp-package: %s', PAD_SPACE), chalk.red(latestDrcp));
			let msg = outputs[2].startsWith('zh') ? '\n当前Workspace下的drcp不是最新的, 如果升级执行命令:\n\t' : '\nCurrent drcp is not latest, you can upgrade it by execute:\n\t';
			console.log(`${msg} ${chalk.red('yarn add dr-comp-package@' + latestDrcp)}`);
		}
		if (recipeVer && latestRecipe && semver.lt(recipeVer, latestRecipe)) {
			console.log(_.padStart('Latest @dr/internal-recipe: %s', PAD_SPACE), chalk.red(latestRecipe));
			let msg = outputs[2].startsWith('zh') ? '\n当前Workspace下的@dr/internal-recipe不是最新的, 如果升级执行命令:\n\t' : '\nCurrent @dr/internal-recipe is not latest, you can upgrade it by execute:\n\t';
			console.log(`${msg} ${chalk.red('yarn add @dr/internal-recipe@' + latestRecipe)}`);
		}
		console.log(_.repeat('-', 50));
		if (latestDrcp)
			cacheVersionInfo(latestDrcp, latestRecipe);
	});
}


function getVersion() {
	var path = Path.dirname(__dirname);
	return require(Path.join(path, 'package.json')).version;
}

function getRecipeVersion() {
	try {
		return require('@dr/internal-recipe/package.json').version;
	} catch (e) {
		return null;
	}
}

function getLatestRecipeVer() {
	if (cachedVersionsInfo)
		return Promise.resolve(cachedVersionsInfo.recipeVersion);
	console.log('Check versions');
	return checkTimeout(processUtils.promisifyExe('npm', 'view', '@dr/internal-recipe', {cwd: process.cwd(), silent: true}))
	.then(output => {
		var m = npmViewReg.exec(output);
		return (m && m[1]) ? m[1] : INTERNAL_RECIPE_VER;
	})
	.catch(e => {
		console.error('[WARN] Command "' + ['npm', 'view', '@dr/internal-recipe'].join(' ') + '" timeout');
		return INTERNAL_RECIPE_VER;
	});
}

function getLatestDrcpVer() {
	if (cachedVersionsInfo)
		return Promise.resolve(cachedVersionsInfo.drcpVersion);
	return checkTimeout(processUtils.promisifyExe('npm', 'view', 'dr-comp-package', {cwd: process.cwd(), silent: true}))
	.then(output => {
		var m = npmViewReg.exec(output);
		return (m && m[1]) ? m[1] : null;
	})
	.catch(e => {
		console.error('[WARN] Command "' + ['npm', 'view', 'dr-comp-package'].join(' ') + '" timeout');
		return null;
	});
}

function checkTimeout(origPromise) {
	var timeout;
	return new Promise((resolve, reject) => {
		origPromise.then(res => {
			clearTimeout(timeout);
			resolve(res);
		})
		.catch(reject);
		timeout = setTimeout(() => reject('Timeout'), 7000);
	});
}

/**
 * @param {*} isDrcpDevMode denote true to copy dr-comp-package dependency list to workspace package.json file
 * @return true if workspace package.json file is changed
 */
function ensurePackageJsonFile(isDrcpDevMode, latestRecipe) {
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
	var workspaceDeps = workspaceJson.dependencies;
	if (isDrcpDevMode) {
		delete workspaceDeps[DRCP_NAME];
		delete workspaceDeps['@dr/internal-recipe'];
		if (workspaceJson.devDependencies) {
			delete workspaceJson.devDependencies[DRCP_NAME];
			delete workspaceJson.devDependencies['@dr/internal-recipe'];
		}
		var drcpDeps = drcpPkJson.dependencies;

		for (let name in drcpDeps) {
			if (_has.call(drcpDeps, name)) {
				if (workspaceDeps[name] == null) {
					needInstall = true;
					workspaceDeps[name] = drcpDeps[name];
					console.log(` + ${name} ${drcpDeps[name]}`);
				}
			}
		}
	} else {
		if (workspaceDeps['@dr/internal-recipe'] == null) {
			workspaceDeps['@dr/internal-recipe'] = '^' + latestRecipe;
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



function readCachedVersionInfo() {
	if (fs.existsSync(cacheFile)) {
		try {
			var json = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
			if (json.date === new Date().toDateString()) {
				versionsFromCache = true;
				return json;
			}
		} catch (e) {
			return null;
		}
	}
	return null;
}

function cacheVersionInfo(latestDrcpVer, latestRecipeVer) {
	if (versionsFromCache)
		return;
	fs.writeFileSync(cacheFile, JSON.stringify({
		drcpVersion: latestDrcpVer,
		recipeVersion: latestRecipeVer,
		date: new Date().toDateString()
	}, null, '  '));
}

function processCmd() {
	// Always print version information
	try {
		require('../lib/gulp/cli').initGulpfile();
		require('gulp/bin/gulp');
	} catch (err) {
		console.error(err);
	}
}


