const through = require('through2');
const es = require('event-stream');
const _ = require('lodash');
const Path = require('path');
const config = require('../config');
const gulp = require('gulp');
const findPackageJson = require('./findPackageJson');
const rwPackageJson = require('./rwPackageJson');
const glob = require('glob');
const log = require('log4js').getLogger('wfh.' + Path.basename(__filename, '.js'));
const fs = require('fs');
const File = require('vinyl');

const linkListFile = config.resolve('destDir', 'link-list.json');
module.exports = {
	linkComponentsAsync: linkComponentsAsync,
	link: link, // return a piped stream
	clean: clean,
	//eachSrcPkJson: eachSrcPkJson,
	eachRecipeSrc: eachRecipeSrc,
	eachDownloadedRecipe: eachDownloadedRecipe,
	eachRecipe: eachRecipe
};

/**
 * Iterate src folder for component items
 * @param {string} projectDir optional, if not present or null, includes all project src folders
 * @param  {Function} callback function(srcDir, recipeDir)
 */
function eachRecipeSrc(projectDir, callback) {
	if (arguments.length === 1) {
		callback = arguments[0];
		_.each(config().projectList, proj => forProject(proj));
	} else if (arguments.length === 2) {
		if (projectDir)
			forProject(projectDir);
		else
			_.each(config().projectList, proj => forProject(proj));
	}

	function forProject(prjDirs) {
		[].concat(prjDirs).forEach(prjDir => {
			_.each(_projectSrcRecipeMap(prjDir), callback);
			var e2eDir = Path.join(prjDir, 'e2etest');
			if (fs.existsSync(e2eDir))
				callback(e2eDir, null);
		});
	}
}

function _projectSrcRecipeMap(projectDir) {
	var srcRecipeMapFile = Path.resolve(projectDir, 'dr.recipes.json');
	var recipeSrcMapping = {};
	var nameSrcSetting = {};

	if (fs.existsSync(srcRecipeMapFile))
		nameSrcSetting = JSON.parse(fs.readFileSync(srcRecipeMapFile, 'utf8'));
	else {
		var pkJsonFile = Path.resolve(projectDir, 'package.json');
		var projectName = fs.existsSync(pkJsonFile) ? require(pkJsonFile).name : Path.basename(projectDir);
		if (fs.existsSync(Path.join(projectDir, 'src')))
			nameSrcSetting['recipes/' + projectName] = 'src';
		else
			nameSrcSetting['recipes/' + projectName] = '.';
	}
	_.each(nameSrcSetting, (srcDir, recipeName) => {
		if (!_.endsWith(recipeName, '-recipe'))
			recipeName += '-recipe';
		recipeSrcMapping[Path.join(projectDir, recipeName)] = Path.resolve(projectDir, srcDir);
	});
	return recipeSrcMapping;
}

function eachDownloadedRecipe(callback) {
	if (config().installedRecipes) {
		_.each(config().installedRecipes, function(pattern) {
			glob.sync(Path.join(config().rootPath, pattern).replace(/\\/g, '/')).forEach(callback);
		});
	}
}

/**
 * @name eachRecipe
 * @param  {Function} callback function(recipeDir)
 */
function eachRecipe(callback) {
	eachRecipeSrc((srcDir, recipeDir) => {
		if (recipeDir)
			callback(recipeDir);
	});
	eachDownloadedRecipe(callback);
	callback(config().rootPath);
}

function link(onPkJsonFile) {
	var streams = [];
	var linkFiles = [];
	eachRecipeSrc(function(src, recipeDir) {
		streams.push(linkToRecipeFile(src, recipeDir, onPkJsonFile));
	});
	return es.merge(streams)
	.pipe(through.obj(function(file, enc, next) {
		if (_.isArray(file)) {
			[].push.apply(linkFiles, file);
		} else {
			log.debug('out: ' + file.path);
			this.push(file);
		}
		next();
	}, function flush(next) {
		var linkFileTrack = new File({
			base: Path.resolve(config().rootPath),
			path: Path.relative(config().rootPath, linkListFile),
			contents: new Buffer(JSON.stringify(linkFiles, null, ' '))
		});
		this.push(linkFileTrack);
		log.debug('out: ' + linkFileTrack.path);
		next();
	}))
	.pipe(gulp.dest(config().rootPath))
	.on('error', function(err) {
		log.error(err);
	});
}

function linkComponentsAsync() {
	var pkJsonFiles = [];
	return new Promise((resolve, reject) => {
		link(file => pkJsonFiles.push(file))
		.on('end', () => resolve(pkJsonFiles))
		.on('error', reject);
	});
}

function clean() {
	var recipes = [];
	if (fs.existsSync(linkListFile)) {
		var list = fs.readFileSync(linkListFile, 'utf8');
		list = JSON.parse(list);
		list.forEach(linkPath => {
			log.info('Removing symbolic link file %s', linkPath);
			fs.unlink(Path.resolve(config().rootPath, linkPath));
		});
	}
	eachRecipeSrc(function(src, recipeDir) {
		if (recipeDir)
			recipes.push(Path.join(recipeDir, 'package.json'));
	});
	return gulp.src(recipes, {base: config().rootPath})
	.pipe(rwPackageJson.removeDependency())
	.pipe(through.obj(function(file, enc, next) {
		log.debug('out: ' + file.path);
		next(null, file);
	}))
	.pipe(gulp.dest(config().rootPath));
}

function linkToRecipeFile(srcDir, recipeDir, onPkJsonFile) {
	return gulp.src('')
		.pipe(findPackageJson(srcDir))
		.pipe(through.obj(function(file, enc, next) {
			log.debug('Found recipeDir %s: file: %s', recipeDir, file.path);
			if (onPkJsonFile)
				onPkJsonFile(file.path, recipeDir);
			next(null, file);
		}))
		//.pipe(rwPackageJson.symbolicLinkPackages(config.resolve('destDir', 'links')))
		.pipe(rwPackageJson.symbolicLinkPackages(config.resolve('rootPath')))
		.pipe(rwPackageJson.addDependency(recipeDir))
		.on('error', function(err) {
			log.error(err);
		});
}

// /**
//  * Not used so far
//  * @param {*} onFile
//  */
// function eachSrcPkJson(onFile) {
// 	eachRecipeSrc((src, recipe) => {
// 		scanPackageJsonFiles(src, file => onFile(file));
// 	});
// }
// /**
//  * Recursively lookup for package.json file, skip any node_modules sub-directory
//  * @param {string} dir
//  * @param {function(filePath)} onFind optional
//  * @return undefined if onFind is present, otherwise return an array of found files
//  */
// function scanPackageJsonFiles(dir, onFind) {
// 	var foundFiles;
// 	if (!onFind) {
// 		foundFiles = [];
// 		onFind = function(jsonFile) {
// 			foundFiles.push(jsonFile);
// 		};
// 	}
// 	_scanFolder(dir, onFind);
// 	return foundFiles;
// }

// function _scanFolder(dir, onFind) {
// 	if (fs.statSync(dir).isDirectory()) {
// 		var pkJsonPath = Path.join(dir, 'package.json');
// 		if (fs.existsSync(pkJsonPath)) {
// 			onFind(pkJsonPath);
// 		} else {
// 			_scanSubFolders(dir, onFind);
// 		}
// 	}
// }

// function _scanSubFolders(parentDir, onFind) {
// 	var folders = fs.readdirSync(parentDir);
// 	folders.forEach(function(name) {
// 		try {
// 			if (name === 'node_modules') {
// 				return;
// 			}
// 			var dir = Path.join(parentDir, name);
// 			_scanFolder(dir, onFind);
// 		} catch (er) {
// 			console.error(er);
// 		}
// 	});
// }