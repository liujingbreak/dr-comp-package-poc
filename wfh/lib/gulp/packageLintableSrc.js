var fs = require('fs');
var log = require('log4js').getLogger('gulp.packageLintableSrc');
var packageUtil = require('../packageMgr/packageUtils');
var config = require('../config');
module.exports = packageLintableSrc;

function packageLintableSrc(packageList, project) {
	var globs = [];
	var wfhPath = config.wfhSrcPath();
	log.info('wfhPath: %s', wfhPath);
	if (wfhPath) {
		globs.push(wfhPath + '/bin/*.js',
			wfhPath + '/lib/**/*.js',
			wfhPath + '/*.js');
	}
	packageUtil.findAllPackages(packageList,
		function(name, entryPath, parsedName, json, packagePath) {
		if (json.dr && json.dr.noLint === true) {
			log.debug('skip ' + name);
			return;
		}
		packagePath = fs.realpathSync(packagePath);
		log.debug(packagePath);
		globs.push(packagePath + '/**/*.js',
			'!' + packagePath + '/spec/**/*.js',
			'!' + packagePath + '/node_modules/**/*.js');
	}, 'src', project);
	return globs;
}
