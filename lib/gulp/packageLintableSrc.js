var fs = require('fs');
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
		packagePath = fs.realpathSync(packagePath);
		log.debug(packagePath);
		globs.push(packagePath + '/**/*.js');
		globs.push('!' + packagePath + '/spec/**/*.js');
		globs.push('!' + packagePath + '/node_modules/**/*');
	}, 'src');
	return globs;
}
