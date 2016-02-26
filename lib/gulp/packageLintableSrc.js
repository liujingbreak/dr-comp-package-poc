var gulp = require('gulp');
var log = require('log4js').getLogger('gulp.packageLintableSrc');
module.exports = packageLintableSrc;

function packageLintableSrc(findAllPackages, packageList) {
	packageList = packageList ? [].concat(packageList) : null;
	var packageSet = {};
	if (packageList) {
		packageList.forEach(function(name) {
			packageSet[name] = true;
		});
	}
	var streams = [];
	findAllPackages(function(name, entryPath, parsedName, json, packagePath) {
		if (packageList === null || {}.hasOwnProperty.call(packageSet, parsedName.name) ||
			{}.hasOwnProperty.call(packageSet, name)) {
			if (json.dr && json.dr.noLint === true) {
				log.debug('skip ' + name);
				return;
			}
			streams.push(gulp.src(packagePath + '/**/*.js'));
		}
	});
	return streams;
}
