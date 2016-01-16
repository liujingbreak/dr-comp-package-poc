var glob = require('glob');
var _ = require('lodash');
var pth = require('path');
var log = require('log4js').getLogger('lib.packageMgr.index');
var fs = require('fs');
var Q = require('q');
var putil = require('./packageUtils');
var config = require('../config');
var Package = require('./packageInstance');

var packageCache = {};
module.exports = {
	loadInternalPackages: loadInternalPackages,
	loadExternalPackages: loadExternalPackages,
	packages: packageCache
};

function loadInternalPackages() {
	var finder = new glob.Glob('*/package.json', {cwd: config().srcDir});
	return packageJsonFoundHandler(finder);
}

function loadExternalPackages() {
	var rootPackageJson = require(pth.join(config().rootPath, 'package.json'));
	_.forOwn(rootPackageJson.dependencies, function(version, dep) {
		var pn = putil.parseName(dep);
		if (!checkPackageName(pn, false)) {
			return;
		}
		log.info('loading ' + pn.name + ' from dependency list');
	});
	return Q.resolve();
}

/**
 * load package from module folder
 * @param  {string} path    path of package.json
 * @param  {string} absPath absolute path of package.json
 */
function loadPackage(path, absPath) {
	var folder = pth.dirname(path);
	var packageJson = JSON.parse(fs.readFileSync(absPath));
	var pn = putil.parseName(packageJson.name);

	if (!checkPackageName(pn, true)) {
		return;
	}
	log.info('loading ' + pn.name + ' from ' + folder);
	//TODO: consider using VM2 instead of `require`

	var absFolder = pth.dirname(absPath);
	var moduleExports;
	var main = packageJson.main;
	if (main && (_.isString(main) || _.isArray(main) && main.length > 0)) {
		try {
			moduleExports = require(absFolder);
		} catch (er) {
			log.error(er.message, er);
			return;
		}
	}
	var pk = new Package({
		name: pn.name,
		path: absFolder,
		exports: moduleExports
	});
	packageCache[pk.name] = pk;
	return pk;
}

function checkPackageName(parsedPackageName, intrusiveWarn) {
	if (!_.includes(config().packageScopes, parsedPackageName.scope)) {
		if (intrusiveWarn) {
			log.warn('Skip intrusive node module: ' + parsedPackageName.name);
		}
		return false;
	}
	//log.debug('', new Error())
	log.debug('>> ' + parsedPackageName.name + '. cache ' + JSON.stringify(_.keys(packageCache)));
	if (_.has(packageCache, parsedPackageName.name)) {
		log.debug(parsedPackageName.name + ' has already been loaded');
		return false;
	}
	return true;
}

function packageJsonFoundHandler(finder) {
	var def = Q.defer();
	finder.on('match', function(path) {
		loadPackage(path, pth.resolve(config().srcDir, path));
	}).on('error', function(er) {
		log.error(er);
		def.reject(er);
	}).on('end', def.resolve);
	return def.promise;
}
