var log = require('log4js').getLogger('gulp.packageLintableSrc');
var packageUtil = require('../packageMgr/packageUtils');
module.exports = packageLintableSrc;

function packageLintableSrc(packageList) {
	var globs = [];
	packageUtil.findAllPackages(packageList, function(name, entryPath, parsedName, json, packagePath) {
		if (json.dr && json.dr.noLint === true) {
			log.debug('skip ' + name);
			return;
		}
		log.debug(packagePath);
		globs.push(packagePath + '/**/*.js');
		globs.push('!' + packagePath + '/spec/**/*.js');
	}, 'src');
	return globs;
}
