/**
 * A lot of hack of nodejs in this file.
 */
var Path = require('path');
var Module = require('module').Module;
var oldNodePath = Module._nodeModulePaths;

Object.defineProperty(exports, 'browserifyPaths', {
	get: getBrowserifyPaths,
	set: p => {}
});

var packagePaths = [
	Path.resolve(__dirname, '..', 'node_modules')
];
var browserifyPaths;

Module._nodeModulePaths = function(from) {
	var paths = oldNodePath.call(this, from);
	var newPaths = [].slice.call(paths);
	newPaths.push.apply(newPaths, packagePaths);
	return newPaths;
};
module.paths = Module._nodeModulePaths(__dirname);
module.parent.paths = Module._nodeModulePaths(module.parent.filename);

//var recipeMgr = require('./gulp/recipeManager');
// recipeMgr.eachDownloadedRecipe(recipeDir => {
// 	packagePaths.push(Path.resolve(recipeDir + '/node_modules'));
// });
// module.paths = Module._nodeModulePaths(__dirname);
// module.parent.paths = Module._nodeModulePaths(module.parent.filename);
// console.log('node search paths:\n' + packagePaths.join('\n'));
for (var m in require.cache) {
	if ({}.hasOwnProperty.call(require.cache, m) && m !== __filename) {
		delete require.cache[m];
	}
}

function getBrowserifyPaths() {
	if (!browserifyPaths) {
		var packageUtils = require('./packageMgr/packageUtils');
		var recipeMgr = require('./gulp/recipeManager');
		var glob = require('glob');
		var log = require('log4js').getLogger(Path.basename(__filename));
		browserifyPaths = packagePaths.slice();
		packageUtils.findBrowserPackageByType('*', (name, entryPath, parsedName, json, packagePath) => {
			browserifyPaths.push(Path.resolve('node_modules', name, 'node_modules'));
		});
		recipeMgr.eachDownloadedRecipe(recipeDir => {
			recipeDir = recipeDir.replace(/\\/g, '/');
			glob.sync(recipeDir + '/node_modules/[^@.]*/node_modules').forEach(path => {
				browserifyPaths.push(Path.resolve(path));
			});
			glob.sync(recipeDir + '/node_modules/@*/*/node_modules').forEach(path => {
				browserifyPaths.push(Path.resolve(path));
			});
		});
		log.debug('browser-resolve search paths:\n' + browserifyPaths.join('\n'));
	}
	return browserifyPaths;
}
