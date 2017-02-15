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
	eachRecipeSrc: eachRecipeSrc,
	eachDownloadedRecipe: eachDownloadedRecipe,
	eachRecipe: eachRecipe
};

/**
 * Iterate recipeSrcMapping items
 * @param {string} projectDir optional, if no present, includes all project src folders
 * @param  {Function} callback function(srcDir, recipeDir)
 */
function eachRecipeSrc(projectDir, callback) {
	// if (!config().dependencyMode) {
	// 	callback(config.resolve('srcDir'), config.resolve('internalRecipeFolder'));
	// }
	if (arguments.length === 1) {
		callback = arguments[0];
		_.each(config().projectList, proj => forProject(proj));
	} else if (arguments.length === 2) {
		forProject(projectDir);
	}
	if (config().recipeSrcMapping) {
		_.forOwn(config().recipeSrcMapping, function(src, recipeDir) {
			callback(Path.resolve(config().rootPath, src), Path.resolve(config().rootPath, recipeDir));
		});
	}
	function forProject(prjDir) {
		callback(Path.join(prjDir, 'src'), config.resolve('destDir', 'recipe', Path.basename(prjDir) + '-recipe'));
		var e2eDir = Path.join(prjDir, 'e2etest');
		callback(e2eDir, config.resolve('destDir', 'recipe', require(e2eDir + '/package.json').name + '-recipe' ));
	}
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
	// if (!config().dependencyMode) {
	// 	callback(config().internalRecipeFolderPath);
	// }
	eachRecipeSrc((srcDir, recipeDir) => callback(recipeDir));
	_.forOwn(config().recipeSrcMapping, function(src, recipeDir) {
		callback(Path.resolve(config().rootPath, recipeDir));
	});
	eachDownloadedRecipe(callback);
	//if (config().dependencyMode)
	callback(config().rootPath);
}

function link() {
	var streams = [];
	var linkFiles = [];
	eachRecipeSrc(function(src, recipeDir) {
		streams.push(doLinkRecipe(src, recipeDir));
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
	}, function(next) {
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
	return new Promise((resolve, reject) => {
		link().on('end', resolve)
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

function doLinkRecipe(srcDir, recipeDir) {
	var recipeFile = Path.resolve(recipeDir, 'package.json');
	return gulp.src(srcDir)
		.pipe(findPackageJson())
		.pipe(through.obj(function(file, enc, next) {
			log.debug('Found ' + file.path);
			next(null, file);
		}))
		//.pipe(rwPackageJson.symbolicLinkPackages(config.resolve('destDir', 'links')))
		.pipe(rwPackageJson.symbolicLinkPackages(config.resolve('rootPath')))
		.pipe(rwPackageJson.addDependency(recipeDir, recipeFile))
		.on('error', function(err) {
			log.error(err);
		});
}
