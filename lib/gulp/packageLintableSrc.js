var log = require('log4js').getLogger('gulp.packageLintableSrc');
module.exports = packageLintableSrc;

function packageLintableSrc(findAllPackages, packageList) {
	var globs = [];
	findAllPackages(packageList, function(name, entryPath, parsedName, json, packagePath) {
		if (json.dr && json.dr.noLint === true) {
			log.debug('skip ' + name);
			return;
		}
		log.debug(packagePath);
		globs.push(packagePath + '/**/*.js');
	});
	return globs;
}
