var log = require('log4js').getLogger('lib.config');
var _ = require('lodash');
var fs = require('fs');
var Path = require('path');
var yamljs = require('yamljs');
var argv = require('yargs').argv;
require('yamlify/register');

var rootPath = argv.root;
var setting;
var localDisabled = false;
var localConfigPath = argv.c || process.env.DR_CONFIG_FILE || Path.join(rootPath, 'config.local.yaml');

var Promise = require('bluebird');
Promise.defer = defer;

function defer() {
	var resolve, reject;
	var promise = new Promise(function() {
		resolve = arguments[0];
		reject = arguments[1];
	});
	return {
		resolve: resolve,
		reject: reject,
		promise: promise
	};
}

if (!setting) {
	load();
}
/**
 * read and return configuration
 * @name config
 * @return {object} setting
 */
module.exports = function() {
	return setting;
};

module.exports.disableLocal = function() {
	localDisabled = true;
	setting = {};
	load();
};

module.exports.reload = function reload() {
	setting = {};
	load();
	return setting;
};

module.exports.set = function(path, value) {
	_.set(setting, path, value);
	return setting;
};

module.exports.get = function(propPath, defaultValue) {
	return _.get(setting, propPath, defaultValue);
};

module.exports.setDefault = function(propPath, value) {
	if (!_.has(setting, propPath)) {
		_.set(setting, propPath, value);
	}
	return setting;
};

/**
 * Resolve a path based on `rootPath`
 * @name resolve
 * @memberof config
 * @param  {string} property name or property path, like "name", "name.childProp[1]"
 * @return {string}     absolute path
 */
module.exports.resolve = function(pathPropName, ...paths) {
	var args = [rootPath, _.get(setting, pathPropName), ...paths];
	return Path.resolve.apply(Path, args);
};

/**
 * Load configuration from config.yaml.
 * Besides those properties in config.yaml, there are extra available properties:
 * - rootPath {string} root path, normally it is identical as process.cwd()
 * 	resolved to relative path to this platform package folder, even it is under node_modules
 * 	folder loaded as dependency
 * - projectList <workspace>/dr.project.list.json
 * - nodePath <workspace>/node_modules
 * - wfhSrcPath meaning wfh source code is linked, it is not installed
 * - _package2Chunk a hash object whose key is `package name`, value is `chunk name`
 */
function load() {
	//log.debug('root Path: ' + rootPath);
	setting = setting || {};

	// projectList
	if (fs.existsSync(Path.join(rootPath, 'dr.project.list.json'))) {
		var prfile = Path.join(rootPath, 'dr.project.list.json');
		delete require.cache[require.resolve(prfile)];
		var projectDirs = require(prfile);
		setting.projectList = _.map(projectDirs, dir => Path.resolve(rootPath, dir));
	}

	// some extra config properties
	_.assign(setting, {
			/** @name rootPath
			* @memberof setting
			*/
			rootPath: rootPath,
			nodePath: Path.join(rootPath, 'node_modules'),
			wfhSrcPath: wfhSrcPath(),
			_package2Chunk: {}
		});

	// Merge from <root>/config.yaml
	var configFileList = [
		Path.resolve(__dirname, '..', 'config.yaml'),
		Path.resolve(rootPath, 'config.yaml')
	];

	if (!localDisabled) {
		if (_.isArray(localConfigPath))
			configFileList.push(...localConfigPath);
		else
			configFileList.push(localConfigPath);
	}

	configFileList.forEach(localConfigPath => mergeFromFile(setting, localConfigPath));

	//setting.internalRecipeFolderPath = Path.resolve(__dirname, '..', setting.internalRecipeFolder);
	if (setting.recipeFolder) {
		setting.recipeFolderPath = Path.resolve(rootPath, setting.recipeFolder);
	}
	if (setting.devMode) {
		log.info('Development mode');
	} else {
		log.info('Production mode');
	}
	validateConfig();

	var defaultEntrySet = setting.defaultEntrySet = {};
	if (setting.defaultEntryPackages) {
		[].concat(setting.defaultEntryPackages).forEach(function(entryFile) {
			defaultEntrySet[entryFile] = true;
		});
	}
	setting.port = normalizePort(setting.port);

	if (!setting.devMode)
		process.env.NODE_ENV = 'production';
	return setting;
}

function mergeFromFile(setting, localConfigPath) {
	if (!fs.existsSync(localConfigPath)) {
		log.warn('File does not exist: %s', localConfigPath);
		return;
	}
	log.info(`Read ${localConfigPath}`);
	var package2Chunk = setting._package2Chunk;
	_.assignWith(setting, yamljs.parse(fs.readFileSync(localConfigPath, 'utf8')), (objValue, srcValue, key, object, source) => {
		if (key === 'vendorBundleMap') {
			if (!_.isObject(objValue) || !_.isObject(srcValue))
				return;
			_.each(srcValue, (packageList, chunk) => {
				for (var p of packageList) {
					package2Chunk[p] = chunk;
				}
			});
			//log.debug('package to chunk: %s', JSON.stringify(package2Chunk, null, '  '));
		}
	});
}

module.exports.wfhSrcPath = wfhSrcPath;
function wfhSrcPath() {
	var wfhPath = Path.dirname(require.resolve('dr-comp-package/package.json'));
	//log.debug('wfhPath: %s', wfhPath);
	return (Path.basename(Path.dirname(wfhPath)) !== 'node_modules') ? wfhPath : false;
}

function validateConfig() {
	if (!setting.nodeRoutePath) {
		log.error('"nodeRoutePath" must be set in config.yaml');
		throw new Error('Invalid configuration');
	}

	['staticAssetsURL',
	'nodeRoutePath',
	'compiledDir'].forEach(function(prop) {
		setting[prop] = trimTailSlash(setting[prop]);
	});

	var contextMapping = setting.packageContextPathMapping;
	if (contextMapping) {
		_.forOwn(contextMapping, function(path, key) {
			contextMapping[key] = trimTailSlash(path);
		});
	}
}

function trimTailSlash(url) {
	if (url === '/') {
		return url;
	}
	return _.endsWith(url, '/') ? url.substring(0, url.length - 1) : url;
}

function normalizePort(val) {
	var port = parseInt(val, 10);

	if (isNaN(port)) {
		// named pipe
		return val;
	}

	if (port >= 0) {
		// port number
		return port;
	}

	return false;
}
