var gulp = require('gulp');
var _ = require('lodash');
var packageUtils = require('../packageMgr/packageUtils');
var log = require('log4js').getLogger('gulp.watchPackages');

module.exports = watch;

function watch(packageList) {
	log.debug(packageList);
	packageUtils.findAllPackages(packageList, function(name, entryPath, parsedName, json, packagePath) {
		log.info('watching package ' + name);
		var globJS = [packagePath + '/**/*.{js,html}', '!' + packagePath + '/spec/**/*'];
		log.debug('  watching: ' + globJS);

		var onChange = _.debounce(function() {
			log.debug('changed: JS ' + jsChanged + ', CSS ' + cssChanged);
			jsChanged = cssChanged = false;
		}, 1000);

		var jsChanged = false;
		var cssChanged = false;

		gulp.watch(globJS, {
			debounceDelay: 1000
		}, function(event) {
			log.info(event);
			jsChanged = true;
			onChange();
		});

		var globCSS = [packagePath + '/**/*.{less,scss}', '!' + packagePath + '/spec/**/*'];
		log.debug('  watching: ' + globCSS);
		gulp.watch(globCSS, {
			debounceDelay: 1000
		}, function(event) {
			log.info(event);
			cssChanged = true;
			onChange();
		});
	});
}
