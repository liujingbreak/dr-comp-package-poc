var Path = require('path');
var fs = require('fs');

module.exports = {
	parseName: parseName,
	findPackagePath: findPackagePath
};

var packageNameReg = /(?:@([^\/]+)\/)?(\S+)/;
/**
 * turn name like @<scope>/packageA into "packageA"
 * @param  {string} longName package name in package.json
 * @return {{scope: string, name: string}}
 */
function parseName(longName) {
	var ret = {name: longName};
	var match = packageNameReg.exec(longName);
	if (match) {
		ret.scope = match[1];
		ret.name = match[2];
	}
	return ret;
}

function findPackagePath(moduleName) {
	var resolved = _recursiveLookupPackagejsonFolder(require.resolve(moduleName));
	return resolved;
}

function _recursiveLookupPackagejsonFolder(targetPath) {
	var path = targetPath;
	var folder = Path.dirname(path);
	while (!fs.existsSync(Path.join(folder, 'package.json'))) {
		var parentFolder = Path.dirname(folder);
		if (folder === parentFolder) {
			// root directory is reached
			throw new Error('package.json is not found for ' + targetPath);
		}
		folder = parentFolder;
	}
	return folder;
}
