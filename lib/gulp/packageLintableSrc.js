var gulp = require('gulp');
var log = require('log4js').getLogger('gulp.packageLintableSrc');
module.exports = packageLintableSrc;

function packageLintableSrc(findAllPackages, packageList) {
	var streams = [];
	findAllPackages(packageList, function(name, entryPath, parsedName, json, packagePath) {
		if (json.dr && json.dr.noLint === true) {
			log.debug('skip ' + name);
			return;
		}
		streams.push(gulp.src(packagePath + '/**/*.js'));
	});
	return streams;
}
