var through = require('through2');
var es = require('event-stream');
var _ = require('lodash');
var Path = require('path');
var config = require('../config');
var gulp = require('gulp');
var findPackageJson = require('./findPackageJson');
var rwPackageJson = require('./rwPackageJson');
var log = require('log4js').getLogger(Path.basename(__filename, '.js'));

module.exports = {
	link: link,
	clean: clean,
	eachRecipeSrc: eachRecipeSrc,
	eachInstalledRecipe: require('../packageMgr/packageUtils').eachInstalledRecipe
};
/**
 * Iterate recipeSrcMapping items
 * @param  {Function} callback function(srcDir, recipeDir)
 */
function eachRecipeSrc(callback) {
	if (!config().dependencyMode) {
		callback(config().srcDir, config().internalRecipeFolder);
	}
	if (config().recipeSrcMapping) {
		_.forOwn(config().recipeSrcMapping, function(src, recipeDir) {
			callback(src, recipeDir);
		});
	}
}

function link() {
	var streams = [];
	eachRecipeSrc(function(src, recipeDir) {
		streams.push(doLinkRecipe(src, recipeDir));
	});
	return es.merge(streams)
	.pipe(through.obj(function(file, enc, next) {
		log.debug('out: ' + file.path);
		next(null, file);
	}))
	.pipe(gulp.dest(config().rootPath))
	.on('error', function(err) {
		log.error(err);
	});
}

function clean() {
	var recipes = [];
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
	var recipeFile = Path.resolve(config().rootPath, recipeDir, 'package.json');
	return gulp.src(srcDir)
		.pipe(findPackageJson())
		.pipe(through.obj(function(file, enc, next) {
			log.debug('in: ' + file.path);
			next(null, file);
		}))
		.pipe(rwPackageJson.linkPkJson('node_modules', recipeFile))
		.pipe(gulp.dest('node_modules'))
		.pipe(rwPackageJson.addDependency(recipeDir, recipeFile))
		.on('error', function(err) {
			log.error(err);
		});
}
