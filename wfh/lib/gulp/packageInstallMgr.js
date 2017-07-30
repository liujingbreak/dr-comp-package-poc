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
var recipeManager = require('./recipeManager');
var log = require('log4js').getLogger('wfh.' + Path.basename(__filename, '.js'));
var semver = require('semver');
var packageUtils = require('../packageMgr/packageUtils');

module.exports = InstallManager;

function InstallManager(projectDir) {
	if (!(this instanceof InstallManager)) {
		return new InstallManager();
	}
	this.projectDir = projectDir;
	this.srcDeps = {}; // src packages needed dependencies
	this.peerDeps = {}; // all packages needed peer dependencies
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
	versionReg: /^\D*(.+)$/,

	scanSrcDeps: function(jsonFiles) {
		var self = this;
		this.compNameSet = {};
		for (let packageJson of jsonFiles) {
			log.debug('scanSrcDepsAsync() ' + Path.relative(config().rootPath, packageJson));
			var json = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
			this.compNameSet[json.name] = json.version;
			var deps = json.dependencies;
			if (deps) {
				for (let name of Object.keys(deps)) {
					let version = deps[name];
					log.debug('scanSrcDepsAsync() dep ' + name);
					self._trackDependency(this.srcDeps, name, version, json.name, packageJson);
				}
			}
			if (json.peerDependencies) {
				for (let name of Object.keys(json.peerDependencies)) {
					let version = json.peerDependencies[name];
					self._trackDependency(this.peerDeps, name, version, json.name, packageJson);
				}
			}
		}
	},

	scanInstalledPeerDeps: function() {
		packageUtils.findAllPackages((name, entryPath, parsedName, json, packagePath) => {
			this.compNameSet[name] = json.version;
			_.each(json.peerDependencies, (version, name) => {
				this._trackDependency(this.peerDeps, name, version, json.name, Path.join(packagePath, 'package.josn'));
			});
		}, 'installed');
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

	_trackDependency: function(trackTo, name, version, byWhom, path) {
		if (!_.has(trackTo, name)) {
			trackTo[name] = [];
		}
		var m = this.versionReg.exec(version);
		trackTo[name].push({
			ver: version,
			verNum: m ? m[1] : null,
			by: byWhom,
			path: path
		});
	},

	printDep: function() {
		this.printComponentDep(false);
	},

	_containsDiffVersion: function(sortedVersions, peerVerList) {
		//var self = this;
		for (let i = 0, l = sortedVersions.length - 1; i < l; i++) {
			let a = sortedVersions[i].ver;
			let b = sortedVersions[i + 1].ver;

			if ((a === '*' || a === '') && (b === '*' || b === ''))
				continue;
			if (a !== b)
				return true;
		}
		if (!peerVerList)
			return false;
		for (let i = 0, l = peerVerList.length - 1; i < l; i++) {
			let a = peerVerList[i].ver;
			let b = peerVerList[i + 1].ver;
			if ((a === '*' || a === '') && (b === '*' || b === ''))
				continue;
			if (a !== b)
				return true;
		}
		return false;
	},

	/**
	 * @return true if there are newly found dependencies added to package.json
	 */
	printComponentDep: function(write) {
		var newDepJson = {};
		var self = this;
		var mainPkFile = this.projectDir ? Path.resolve(this.projectDir, 'package.json') :
			Path.resolve(config().rootPath, 'package.json');

		var mainPkjson, mainDeps;
		if (fs.existsSync(mainPkFile)) {
			mainPkjson = fs.readFileSync(mainPkFile, 'utf8');
			mainPkjson = JSON.parse(mainPkjson);
			mainDeps = _.assign({}, mainPkjson.dependencies, mainPkjson.devDependencies);
		}
		var depNames = Object.keys(this.srcDeps);
		var peerDepNames = Object.keys(this.peerDeps);
		if (depNames.length === 0 && peerDepNames.length === 0)
			return;
		var nameWidth = _.maxBy([...depNames, ...peerDepNames], name => name.length).length;
		if (depNames.length > 0) {
			log.info(_.pad(' Components Dependency ', 60, '-'));
			let countDep = 0;
			for (let name of Object.keys(this.srcDeps)) {
				let versionList = this.srcDeps[name];
				let item = self.sortByVersion(versionList)[0];
				let hasDiffVersion = self._containsDiffVersion(versionList, self.sortByVersion(this.peerDeps[name]));
				log.info(`${(hasDiffVersion ? chalk.red : chalk.cyan)(_.padStart(name, nameWidth, ' '))} ${versionList.length > 1 ? '┬─' : '──'} ${_.padEnd(item.ver, 9)} ${item.by}`);
				var i = versionList.length - 1;
				for (let rest of versionList.slice(1)) {
					log.info(`${_.repeat(' ', nameWidth)} ${i === 1 ? '└─' : '├─'} ${_.padEnd(rest.ver, 9)} ${rest.by}`);
					i--;
				}
				if (!_.has(mainDeps, name) || mainDeps[name] !== versionList[0].ver) {
					newDepJson[name] = versionList[0].ver;
				}
				countDep++;
			}
			log.info(_.pad(` total ${chalk.green(countDep)} `, 60, '-'));
		}

		this._printPeerDep(peerDepNames, newDepJson, mainDeps);

		var needInstall = _.size(newDepJson) > 0;
		if (needInstall) {
			log.warn(chalk.blue('New component\'s dependencies are found:'));
			_.each(newDepJson, (ver, name) => log.info(chalk.blue('\t+ %s: %s'), name, ver));
		}

		mkdirp.sync(config().destDir);
		//var file = Path.join(config().destDir, 'component-dependencies.json');

		if (write) {
			if (!mainPkjson.dependencies)
				mainPkjson.dependencies = {};
			_.assign(mainPkjson.dependencies, newDepJson);
			fs.writeFileSync(mainPkFile, JSON.stringify(mainPkjson, null, '  '));
			log.info('%s is written.', mainPkFile);
			return needInstall;
		}
		return false;
	},

	/**
	 * Sort by descending
	 * @param verInfoList {ver: string, by: string, name: string}
	 */
	sortByVersion: function(verInfoList) {
		if (verInfoList == null)
			return verInfoList;
		verInfoList.sort((info1, info2) => {
			if (info1.verNum != null && info2.verNum != null)
				return semver.rcompare(info1.verNum, info2.verNum);
			else if (info1.verNum != null && info2 == null)
				return -1;
			else if (info2.verNum != null && info1 == null)
				return 1;
			else if (info1.ver > info2.ver)
				return -1;
			else if (info1.ver < info2.ver)
				return 1;
			else
				return 0;
		});
		return verInfoList;
	},

	_printPeerDep: function(peerDepNames, newDepJson, mainDeps) {
		var self = this;
		if (!peerDepNames || peerDepNames.length === 0)
			return;
		var nameWidth = _.maxBy(peerDepNames, name => name.length).length;
		let countDep = 0;
		log.info(_.pad(' Components Peer Dependency ', 60, '-'));
		for (let name of peerDepNames) {
			let versionList = this.peerDeps[name];
			let item = this.sortByVersion(versionList)[0];
			let hasDiffVersion = self._containsDiffVersion(versionList);
			var skip = false;
			var skipReason;
			if (_.has(newDepJson, name) || name === '@dr/internal-recipe')
				skip = true;
			if (_.has(this.compNameSet, name)) {
				skipReason = _.padEnd(`Linked:`, 'Installed:'.length);
				// TODO: warn if version range does not match for this.compNameSet[name]
				skip = true;
			}
			if (_.has(mainDeps, name)) {
				skipReason = `Installed:`;
				skip = true;
			}
			log.info(`${skipReason} ${(hasDiffVersion ? chalk.red : chalk.cyan)(_.padStart(name, nameWidth, ' '))} ${versionList.length > 1 ? '┬─' : '──'} ${_.padEnd(item.ver, 9)} ${item.by}`);
			var i = versionList.length - 1;
			for (let rest of versionList.slice(1)) {
				log.info(`${_.repeat(' ', nameWidth + 'Installed:'.length)}  ${i === 1 ? '└─' : '├─'} ${_.padEnd(rest.ver, 9)} ${rest.by}`);
				i--;
			}
			if (skip)
				continue;
			if (!_.has(mainDeps, name) || mainDeps[name] !== versionList[0].ver) {
				newDepJson[name] = versionList[0].ver;
			}
			countDep++;
		}
		log.info(_.pad(` total ${chalk.green(countDep)} added `, 60, '-'));
	}
};
