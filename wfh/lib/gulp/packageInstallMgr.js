/**
 * At the beginning, I designed this platform running on Node 5.x with NPM 3.x environment.
 * which has a flat node_modules structure, I forgot to consider NPM 2.x 's nested
 * node_modules structure issue.
 *
 * So, this file helps to resolve NPM 2.x's nested node_modules structure issue,
 * and some dependencies conflict check function.
 */
var fs = require('fs');
var _ = require('lodash');
var del = require('del');
var mkdirp = require('mkdirp');
var chalk = require('chalk');
var Path = require('path');
var config = require('../config');
var buildUtils = require('./buildUtils');
var glob = require('glob');
var Promise = require('bluebird');
var recipeManager = require('./recipeManager');
var log = require('log4js').getLogger('wfh.' + Path.basename(__filename, '.js'));
var readFileAsync = Promise.promisify(fs.readFile, {context: fs});
var semver = require('semver');

module.exports = InstallManager;

function InstallManager(projectDir) {
	if (!(this instanceof InstallManager)) {
		return new InstallManager();
	}
	this.projectDir = projectDir;
	this.srcDeps = {}; // src packages needed dependencies
	this.installedDeps = {}; // installed node_modules packages needed dependencies
}

InstallManager.fileExists = fileExists;
InstallManager.moveFile = moveFile;

function fileExists(file) {
	try {
		fs.accessSync(file, fs.R_OK);
		return true;
	} catch (e) {
		return false;
	}
}

function moveFile(src, target) {
	try {
		if (fileExists(target)) {
			var targetMtime = fs.statSync(target).mtime.getTime();
			var srcMtime = fs.statSync(src).mtime.getTime();
			if (srcMtime > targetMtime) {
				log.info('move ' + Path.relative(config().rootPath, src) + '\nto ' +
					Path.relative(config().rootPath, target));
				del.sync(target);
				mkdirp.sync(Path.dirname(target));
				fs.renameSync(src, target);
			}
		} else {
			log.info('move ' + src + ' to ' + target);
			mkdirp.sync(Path.dirname(target));
			fs.renameSync(src, target);
		}
	} catch (err) {
		log.error(err);
		if (err.toString().indexOf('EPERM') > 0 ) {
			log.error('Please try this command again.');
		}
		throw err;
	}
}

var packageNameReg = /^.*?\/((?:@[^\/]+\/)?[^\/]+)$/;
InstallManager.prototype = {
	scanSrcDeps: function(jsonFiles) {
		var self = this;
		jsonFiles.forEach(packageJson => {
			log.debug('scanSrcDepsAsync() ' + Path.relative(config().rootPath, packageJson));
			var json = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
			var deps = json.dependencies;
			_.forOwn(deps, function(version, name) {
				log.debug('scanSrcDepsAsync() dep ' + name);
				self.trackSrcDep(name, version, json.name, packageJson);
			});
		});
	},

	flattenInstalledRecipes: function() {
		log.info('flattenInstalledRecipes()');
		recipeManager.eachDownloadedRecipe(recipeDir => {
			return this._flattenRecipe(recipeDir);
		});
		this.printDep();
	},

	_flattenRecipe: function(recipeDir) {
		if (!fileExists(recipeDir)) {
			return;
		}
		recipeDir = recipeDir.replace(/\\/g, '/');
		glob.sync(recipeDir + '/node_modules/@*')
		.forEach(path => {
			var dir = Path.basename(path);
			var target = Path.join('node_modules', dir);
			if (!fileExists(target)) {
				mkdirp.sync(target);
				log.debug('create folder: ' + path);
			}
		});
		glob.sync(recipeDir + '/node_modules/[^@.]*')
		.forEach(this.movePackage);
		glob.sync(recipeDir + '/node_modules/@*/*')
		.forEach(this.movePackage);

		del(Path.join(recipeDir, 'node_modules'));
	},

	installRecipeAsync: function(recipeDir) {
		log.info(chalk.blue('install recipe: ' + recipeDir));
		return buildUtils.promisifyExe('npm', 'install', recipeDir);
	},

	//TODO: choose version
	moveMatchedDepsToLevel1: function(targetPackagePath, lookingForDeps) {
		var nm = Path.resolve(targetPackagePath, 'node_modules');
		if (fileExists(nm, fs.R_OK)) {
			_.forOwn(lookingForDeps, function(value, depName) {
				if (fileExists(Path.resolve(nm, depName), fs.R_OK)) {
					delete lookingForDeps[depName];
					log.debug('move vendor deps to level 1 node_modules folder: ' + depName);
					fs.renameSync(Path.resolve(nm, depName), Path.resolve('node_modules', depName));
				}
			});
		}
	},

	movePackage: path => {
		var target = Path.resolve('node_modules', packageNameReg.exec(path)[1]);
		moveFile(path, target, true);
	},

	trackSrcDep: function(name, version, byWhom, path) {
		if (!_.has(this.srcDeps, name)) {
			this.srcDeps[name] = [];
		}
		this.srcDeps[name].push({
			ver: version,
			by: byWhom,
			path: path
		});
	},

	trackInstalledDepAsync: function(packageJsonPath) {
		return readFileAsync(packageJsonPath, 'utf8')
		.then(data => {
			var pkjson = JSON.parse(data);
			if (!{}.hasOwnProperty.call(this.installedDeps, pkjson.name)) {
				this.installedDeps[pkjson.name] = [];
			}
			this.installedDeps[pkjson.name].push({
				ver: pkjson.version
			});
		});
	},

	versionReg: /(?:\^|~|>=|>|<|<=)?(.*)/,

	/**
	 * install dependencies which are tracked by trackSrcDep()
	 * @return {[type]} [description]
	 */
	installDependsAsync: function() {
		log.info('installDependsAsync()');
		var prom = Promise.resolve();
		_.forOwn(this.srcDeps, (versionList, name) => {
			var lastVer;
			if (versionList.some(item => {
				if (lastVer !== undefined && item.ver !== lastVer) {
					return true;
				}
				lastVer = item.ver;
			})) {
				log.warn('Different dependency version found: ' + name  +
					_.map(versionList, item => item.ver + ' ' + item.by).join(', '));
			}
			var pkj = Path.join('node_modules', name, 'package.json');
			if (fileExists(pkj)) {
				var currVer = JSON.parse(fs.readFileSync(pkj, 'utf8')).version;
				if (semver.satisfies(currVer, versionList[0].ver)) {
					log.debug('dependency ' + name + '@%s exists', currVer);
					return;
				} else
					log.debug('Existing %s does not satisfy expected %s', currVer, versionList[0].ver);
			}
			prom = prom.then(() => {
				return buildUtils.promisifyExe('npm', 'install', name + '@' + versionList[0].ver)
				.catch(err => {
					log.error('Failed in "npm i %s"', name + '@' + versionList[0].ver);
					return Promise.reject(err);
				});
			});
		});
		return prom;
	},

	printDep: function() {
		this.printComponentDep(false);
	},

	containsDiffVersion: function(versionList) {
		var leftItem;
		for (var i = 0, l = versionList.length - 1; i < l; i++) {
			leftItem = versionList[i];
			var toCompare = versionList.slice(i + 1);
			if (!_.find(toCompare, isSame)) {
				return true;
			}
		}
		function isSame(item) {
			return leftItem.ver === item.ver;
		}
		return false;
	},

	printComponentDep: function(write) {
		var newDepJson = {};
		var self = this;
		log.info(_.pad(' Components Dependency ', 60, '-'));
		var mainPkFile = this.projectDir ? Path.resolve(this.projectDir, 'package.json') :
			Path.resolve(config().rootPath, 'package.json');

		var mainPkjson, mainDeps;
		if (fs.existsSync(mainPkFile)) {
			mainPkjson = fs.readFileSync(mainPkFile);
			mainPkjson = JSON.parse(mainPkjson);
			mainDeps = _.assign({}, mainPkjson.dependencies, mainPkjson.devDependencies);
		}
		var depNames = _.keys(this.srcDeps);
		if (depNames.length === 0)
			return;
		var nameWidth = _.maxBy(depNames, name => name.length).length;

		_.forOwn(this.srcDeps, (versionList, name) => {
			var item = versionList[0];
			var hasDiffVersion = self.containsDiffVersion(versionList);
			log.info(`${(hasDiffVersion ? chalk.red : chalk.cyan)(_.padStart(name, nameWidth, ' '))} <- ${_.padEnd(item.ver, 9)} ${item.by}`);
			for (var rest of versionList.slice(1)) {
				log.info(`${_.repeat(' ', nameWidth)}    ${_.padEnd(rest.ver, 9)} ${rest.by}`);
			}
			if (!_.has(mainDeps, name) || mainDeps[name] !== versionList[0].ver) {
				newDepJson[name] = versionList[0].ver;
			}
		});
		_.each(newDepJson, (ver, name) => log.info(chalk.blue('\t+ %s: %s'), name, ver));

		mkdirp.sync(config().destDir);
		//var file = Path.join(config().destDir, 'component-dependencies.json');

		if (write) {
			if (!mainPkjson.devDependencies)
				mainPkjson.devDependencies = {};
			_.assign(mainPkjson.devDependencies, newDepJson);
			fs.writeFileSync(mainPkFile, JSON.stringify(mainPkjson, null, '  '));
		}
		log.info('%s is written.', mainPkFile);
	}
};
