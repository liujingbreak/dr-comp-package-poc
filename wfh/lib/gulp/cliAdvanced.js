/**
 * Do not require this file until wfh dependencies is installed and config.yaml file is generated
 */
var PackageInstall = require('./packageInstallMgr');
var config = require('../config');
var shell = require('shelljs');
var jsYaml = require('js-yaml');
var Path = require('path');
var fs = require('fs');
var _ = require('lodash');
var chalk = require('chalk');
var gulp = require('gulp');
var through = require('through2');
var recipeManager = require('./recipeManager');
var pify = require('pify');
var File = require('vinyl');
//var buildUtils = require('./buildUtils');
require('../logConfig')(config().rootPath);
var packageUtils = require('../packageMgr/packageUtils');

//exports.writeProjectDep = writeProjectDep;
exports.listCompDependency = listCompDependency;
exports.addupConfigs = addupConfigs;
exports.cleanPackagesWalkerCache = cleanPackagesWalkerCache;
exports.clean = clean;
exports.bumpDirsAsync = bumpDirsAsync;
exports.bumpProjectsAsync = bumpProjectsAsync;

// function writeProjectDep(projDir) {
// 	var installer = new PackageInstall(projDir);
// 	var srcDirs = [];
// 	recipeManager.eachRecipeSrc(projDir, function(src, recipe) {
// 		srcDirs.push(src);
// 	});
// 	return installer.scanSrcDeps(srcDirs)
// 	.then(() => {
// 		return installer.printDep();
// 	});
// }

/**
 * @return true if there are newly found dependencies added to package.json
 */
function listCompDependency(pkJsonFiles, write) {
	var installer = new PackageInstall();
	installer.scanSrcDeps(pkJsonFiles);
	return installer.printComponentDep(write);
}

function addupConfigs() {
	var componentConfigs = {outputPathMap: {}, vendorBundleMap: {}, browserSideConfigProp: []};
	var vendorBundleMap = componentConfigs.vendorBundleMap;
	var browserSideConfigProp = componentConfigs.browserSideConfigProp;
	//var entryPageMapping = componentConfigs.entryPageMapping;
	var componentConfigs4Env = {}; // key is env:string, value is componentConfigs
	var trackOutputPath = {}; // For checking conflict
	packageUtils.findAllPackages((name, entryPath, parsedName, json, packagePath) => {
		var dr = json.dr;
		if (!dr)
			return;
		// if (dr.globalConfig) {
		// 	Object.assign(componentConfigs, dr.globalConfig.public);
		// 	browserSideConfigProp.push(..._.keys(dr.globalConfig.public));
		// }

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
		if (_.has(trackOutputPath, outputPath)) {
			console.log(chalk.yellow('[Warning] Conflict outputPath setting "%s" for both %s and %s, resolve conflict by adding a config file,'), outputPath, trackOutputPath[outputPath], name);
			console.log(chalk.yellow('%s\'s "outputPath" will be changed to %s', name, parsedName.name));
			outputPath = parsedName.name;
		}
		trackOutputPath[outputPath] = name;
		// if (dr.entryPage || dr.entryView) {
		// 	entryPageMapping[name] = componentConfigs.outputPathMap[name] = outputPath;
		// } else {
		componentConfigs.outputPathMap[name] = outputPath;
		//}
		// chunks
		var chunk = _.has(json, 'dr.chunk') ? dr.chunk : dr.bundle;
		if (!chunk && (dr.entryPage || dr.entryView))
			chunk = parsedName.name;
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
		var tmplFile = Path.join(__dirname, 'templates', 'config.' + env + '-template.yaml');
		if (fs.existsSync(tmplFile)) {
			configs = Object.assign(jsYaml.safeLoad(fs.readFileSync(tmplFile, 'utf8'), {filename: tmplFile}), configs);
		}
		res['config.' + env + '.yaml'] = jsYaml.safeDump(configs);
	});
	cleanPackagesWalkerCache();
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

function cleanPackagesWalkerCache() {
	var packageInfoCacheFile = config.resolve('destDir', 'packageInfo.json');
	if (fs.existsSync(packageInfoCacheFile))
		fs.unlink(packageInfoCacheFile);
}

function clean() {
	return new Promise((resolve, reject) => {
		require('./recipeManager').clean()
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

function bumpDirsAsync(dirs, versionType) {
	var findPackageJson = require('./findPackageJson');
	var srcMap = _srcRecipeMap();
	var srcDirs = Object.keys(srcMap);
	var bumpDirs = [...dirs];
	dirs.forEach(dir => {
		dir = Path.resolve(dir);
		var foundSrc = _.find(srcDirs, src => dir.startsWith(src));
		if (!foundSrc)
			return;
		var recipeDir = srcMap[foundSrc];
		if (recipeDir && !_.includes(bumpDirs, recipeDir)) {
			bumpDirs.push(recipeDir);
			console.log('Bump recipe package %s', recipeDir);
		}
	});

	var stream = gulp.src('')
	.pipe(findPackageJson(bumpDirs))
	.pipe(through.obj(function(file, enc, next) {
		file.base = '/';
		//file.path = Path.relative(config().rootPath, file.path);
		console.log(file.path);
		file.contents = new Buffer(fs.readFileSync(file.path, 'utf8'));
		this.push(file);
		next();
	}))
	.pipe(bumpVersion(versionType))
	.pipe(gulp.dest('/'));

	return new Promise((res, rej) => {
		stream.on('error', function(err) {
			rej(err);
		})
		.on('end', function() {
			recipeManager.linkComponentsAsync()
			.then(res)
			.catch(rej);
		});
	});
}

function bumpProjectsAsync(projects, versionType) {
	var srcDirs = [];
	var recipes = [];
	recipeManager.eachRecipeSrc(projects, function(src, recipe) {
		srcDirs.push(src);
		if (recipe)
			recipes.push(recipe);
	});
	var realPathAsync = pify(fs.realpath.bind(fs));
	var stream = gulp.src('.')
		.pipe(through.obj(function(file, enc, next) {
			next(null);
		}, function(next) {
			var self = this;
			var proms = [];
			packageUtils.findAllPackages((name, entryPath, parsedName, json, packagePath) => {
				proms.push(realPathAsync(packagePath).then(packagePath => {
					self.push(new File({
						base: config().rootPath,
						path: Path.relative(config().rootPath, Path.join(packagePath, 'package.json')),
						contents: new Buffer(fs.readFileSync(Path.resolve(packagePath, 'package.json'), 'utf8'))
					}));
				}));
			}, 'src', projects);
			recipes.forEach(function(recipe) {
				self.push(new File({
					base: config().rootPath,
					path: Path.resolve(recipe, 'package.json'),
					contents: new Buffer(fs.readFileSync(Path.resolve(recipe, 'package.json'), 'utf8'))
				}));
			});
			Promise.all(proms).then(() => next());
		}))
		.pipe(through.obj(function(file, enc, next) {
			file.base = config().rootPath;
			console.log('bump: ' + file.path);
			next(null, file);
		}))
		.pipe(bumpVersion())
		.pipe(gulp.dest(config().rootPath));

	return new Promise((res, rej) => {
		stream.on('error', function(err) {
			rej(err);
		})
		.on('end', function() {
			recipeManager.linkComponentsAsync()
			.then(res)
			.catch(rej);
		});
	});
}

function bumpVersion(versionType) {
	var type = 'patch';
	if (versionType) {
		if (!{major: 1, minor: 1, patch: 1, prerelease: 1}.hasOwnProperty(versionType)) {
			console.log(chalk.red('expecting bump type is one of "major|minor|patch|prerelease", but get: ' + versionType));
			throw new Error('Invalid -v parameter');
		}
		type = versionType;
	}
	return require('gulp-bump')({
		type: type
	});
}

function _srcRecipeMap() {
	var rsMap = {};
	recipeManager.eachRecipeSrc((srcDir, recipeDir) => {
		if (srcDir && recipeDir) {
			rsMap[Path.resolve(srcDir)] = Path.resolve(recipeDir);
		}
	});
	return rsMap;
}
