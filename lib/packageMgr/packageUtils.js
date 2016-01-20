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

/**
 * @param  {string} moduleName
 * @return {string|null} return null if not found
 */
function findPackagePath(moduleName) {
	var resolvedPath;
	try {
		resolvedPath = require.resolve(moduleName);
	} catch (er) {
		if (er.code === 'MODULE_NOT_FOUND') {
			return null;
		} else {
			throw er;
		}
	}
	var resolved = _recursiveLookupPackagejsonFolder(resolvedPath);
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
