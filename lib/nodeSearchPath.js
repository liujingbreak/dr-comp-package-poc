/**
 * A lot of hack of nodejs in this file.
 */
var Path = require('path');
var Module = require('module').Module;
var oldNodePath = Module._nodeModulePaths;
var config = require('./config');
//var CONFIG_FILE = Path.resolve(__dirname, './config.js');
var browserifyPaths, appPath;

Object.defineProperty(exports, 'browserifyPaths', {
	get: getBrowserifyPaths
});

var packagePaths = [
	//Path.resolve(config.resolve('destDir', 'links'))
];
if (process.env.WFH_NODE_PATH)
	packagePaths.push(process.env.WFH_NODE_PATH);
// --- Attention: Hack is here ---
// Insert "dist/links" and "web-fun-house/node_modules" into node require() search path,
// at the position of before original path of "<project-root>/node_modules".
// `process.env.WFH_NODE_PATH` is allowed to be set as extra Node and Browserify search path

if (config().dependencyMode) {
	packagePaths.push(Path.resolve(__dirname, '..', 'node_modules'));
	appPath = Path.resolve(__dirname, '..', '..');
} else {
	appPath = Path.resolve(__dirname, '..', 'node_modules');
}
Module._nodeModulePaths = function(from) {
	var paths = oldNodePath.call(this, from);
	var newPaths = [].slice.call(paths);
	var appPathIdx = 0;
	if (newPaths.some(path => {
		if (path === appPath)
			return true;
		appPathIdx++;
		return false;
	})) {
		[].splice.apply(newPaths, [appPathIdx, 0].concat(packagePaths));
	}
	return newPaths;
};
module.paths = Module._nodeModulePaths(__dirname || process.cwd());
module.parent.paths = Module._nodeModulePaths(module.parent.filename);

// for (var m in require.cache) {
// 	if ({}.hasOwnProperty.call(require.cache, m) &&
// 		m !== __filename && m !== CONFIG_FILE) {
// 		delete require.cache[m];
// 	}
// }

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
