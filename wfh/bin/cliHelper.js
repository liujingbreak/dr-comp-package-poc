/**
 * Do not require this file until wfh dependencies is installed
 */
var PackageInstall = require('../lib/gulp/packageInstallMgr');
var recipeManager = require('../lib/gulp/recipeManager');
var config = require('../lib/config');
var shell = require('shelljs');
var jsYaml = require('js-yaml');
var _ = require('lodash');
//var buildUtils = require('../lib/gulp/buildUtils');
require('../lib/logConfig')(config().rootPath);
var packageUtils = require('../lib/packageMgr/packageUtils');

exports.writeProjectDep = writeProjectDep;
exports.listCompDependency = listCompDependency;
exports.addupConfigs = addupConfigs;
exports.clean = clean;

function writeProjectDep(projDir) {
	var installer = new PackageInstall(projDir);
	var srcDirs = [];
	recipeManager.eachRecipeSrc(projDir, function(src, recipe) {
		srcDirs.push(src);
	});
	return installer.scanSrcDepsAsync(srcDirs)
	.then(() => {
		return installer.printDep();
	});
}

function listCompDependency(write) {
	var installer = new PackageInstall();
	var srcDirs = [];
	recipeManager.eachRecipeSrc(function(src, recipe) {
		srcDirs.push(src);
	});
	return installer.scanSrcDepsAsync(srcDirs)
	.then(() => {
		return installer.printComponentDep(write);
	});
}

function addupConfigs() {
	var componentConfigs = {assetsDirMap: {}, vendorBundleMap: {}, browserSideConfigProp: [], entryPageMapping: {}};
	var vendorBundleMap = componentConfigs.vendorBundleMap;
	var browserSideConfigProp = componentConfigs.browserSideConfigProp;
	var entryPageMapping = componentConfigs.entryPageMapping;
	var componentConfigs4Env = {}; // key is env:string, value is componentConfigs

	packageUtils.findAllPackages((name, entryPath, parsedName, json, packagePath) => {
		var dr = json.dr;
		if (!dr)
			return;

		// component customized configuration properties
		_addupCompConfigProp(componentConfigs, name, browserSideConfigProp, dr.config);
		_.each(dr, (value, key) => {
			var m = /^config\.(.*)$/.exec(key);
			if (!m)
				return;
			var env = m[1];
			if (!_.has(componentConfigs4Env, env))
				componentConfigs4Env[env] = {browserSideConfigProp: []};
			_addupCompConfigProp(componentConfigs4Env[env], name, componentConfigs4Env[env].browserSideConfigProp, value);
		});

		// outputPath
		var outputPath = dr.outputPath || _.get(json, 'dr.output.path') || parsedName.name;
		if (dr.entryPage || dr.entryView)
			entryPageMapping[name] = componentConfigs.assetsDirMap[name] = outputPath;

		// chunks
		var chunk = _.has(json, 'dr.chunk') ? dr.chunk : dr.bundle;
		if (chunk) {
			if (_.has(vendorBundleMap, chunk))
				vendorBundleMap[chunk].push(name);
			else
				vendorBundleMap[chunk] = [name];
		}
	});

	var superConfig = require('dr-comp-package/config.yaml');
	deeplyMergeJson(superConfig, componentConfigs);
	var res = {'config.yaml': jsYaml.safeDump(superConfig)};
	_.each(componentConfigs4Env, (configs, env) => {
		res['config.' + env + '.yaml'] = jsYaml.safeDump(configs);
	});
	return Promise.resolve(res);
}

/**
 * @param {object} setting hash object to be added to
 * @param {object} configJson component's package.json -> "dr.config.<environment>"
 */
function _addupCompConfigProp(componentConfigs, compName, browserSideConfigProp, configJson) {
	if (!configJson)
		return;
	// component customized configuration properties
	var componentConfig = _.assign({}, configJson.public, configJson.server);
	if (_.size(componentConfig) > 0 )
		componentConfigs[compName] = componentConfig;

	// browserSideConfigProp
	browserSideConfigProp.push(..._.map(_.keys(configJson.public), key => compName + '.' + key));
}

function clean() {
	return new Promise((resolve, reject) => {
		require('../lib/gulp/recipeManager').clean()
		.on('end', resolve)
		.on('error', err => {
			console.error(err);
			reject(new Error(err));
		});
	})
	.then(()=> {
		shell.rm('-rf', config().staticDir);
		shell.rm('-rf', config().destDir);
	});
}

function deeplyMergeJson(target, src, customizer) {
	_.each(src, (sValue, key) => {
		var tValue = target[key];
		var c = customizer ? customizer(tValue, sValue, key) : undefined;
		if (c !== undefined)
			target[key] = c;
		else if (Array.isArray(tValue) && Array.isArray(sValue))
			target[key] = _.union(tValue, sValue);
		else if (_.isObject(tValue) && _.isObject(sValue))
			deeplyMergeJson(tValue, sValue);
		else
			target[key] = sValue;
	});
}
