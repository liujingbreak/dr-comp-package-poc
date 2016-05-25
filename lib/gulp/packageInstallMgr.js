/**
 * At the beginning, I designed this platform running on Node 5.x with NPM 3.x environment.
 * which has a flat node_modules structure, I forgot to consider NPM 2.x 's nested
 * node_modules structure issue.
 *
 * So, this file helps to resolve NPM 2.x's nested node_modules structure issue,
 * and some dependencies conflict check function.
 */
var gulp = require('gulp');
var through = require('through2');
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
var log = require('log4js').getLogger(Path.basename(__filename, '.js'));
var findPackageJson = require('./findPackageJson');
var readFileAsync = Promise.promisify(fs.readFile, {context: fs});
module.exports = InstallManager;

function InstallManager() {
	if (!(this instanceof InstallManager)) {
		return new InstallManager();
	}
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
	scanSrcDepsAsync: function(srcDirs) {
		log.info('scanSrcDepsAsync()');
		var self = this;
		srcDirs = [].concat(srcDirs);
		return new Promise((resolve, reject) => {
			gulp.src(srcDirs).pipe(findPackageJson())
			.pipe(through.obj(function(file, enc, next) {
				self.checkPackageDep(file.path);
				next();
			}, function flush(next) {
				next();
				resolve();
			})).pipe(gulp.dest('.'));
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

	checkPackageDep: function(packageJson) {
		log.info('checkPackageDep() ' + Path.relative(config().rootPath, packageJson));
		var self = this;
		var json = JSON.parse(fs.readFileSync(packageJson, 'utf8'));
		var deps = json.dependencies;
		_.forOwn(deps, function(version, name) {
			log.debug('checkPackageDep() dep ' + name);
			self.trackSrcDep(name, version, json.name, packageJson);
		});
	},

	trackSrcDep: function(name, version, byWhom, path) {
		if (!{}.hasOwnProperty.call(this.srcDeps, name)) {
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
				ver: pkjson.version,

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
			if (fileExists(Path.join('node_modules', name, 'package.json'))) {
				log.debug('dependency ' + name + ' exists');
				return;
			}
			prom = prom.then(() => {
				return buildUtils.promisifyExe('npm', 'install', name + '@' + versionList[0].ver);
			});
		});
		return prom;
	},

	printDep: function() {
		//var str = JSON.stringify(this.srcDeps, null, ' ');
		log.info('------ package dependencies -------');
		_.forOwn(this.srcDeps, (versionList, name) => {
			log.info(name + ' <- ' + _.map(versionList, item => item.ver + ' ' + item.by).join(', '));
		});
		//mkdirp.sync(config().destDir);
		//fs.writeFileSync(Path.join(config().destDir, 'package-dependencies.json'), str);
	}
};
