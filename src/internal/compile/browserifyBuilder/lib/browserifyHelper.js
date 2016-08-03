var through = require('through2');
var Path = require('path');
var stream = require('stream');
var __api = require('__api');
var log = require('@dr/logger').getLogger(__api.packageName + '.browserifyHelper');
var swig = require('swig');
var fs = require('fs');
var esParser = require('./esParser');
var assetsProcesser = require('@dr-core/assets-processer');
var _ = require('lodash');
swig.setDefaults({autoescape: false});
var config, injector;

module.exports = function(_config, _injector) {
	config = _config;
	injector = _injector;
	var buildins = ['assert', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto', 'dgram', 'dns',
	'domain', 'events', 'fs', 'http', 'https', 'module', 'net', 'os', 'path', 'punycode', 'querystring',
	'readline', 'repl', 'stream', '_stream_duplex', '_stream_passthrough', '_stream_readable',
	'_stream_transform', '_stream_writable', 'string_decoder', 'sys', 'timers', 'tls', 'tty', 'url',
	'util', 'vm', 'zlib', '_process'];

	var buildinSet = {};
	buildins.forEach(function(name) {
		buildinSet[name] = true;
	});
	return {
		JsBundleEntryMaker: JsBundleEntryMaker,
		JsBundleWithI18nMaker: JsBundleWithI18nMaker,
		buildins: buildins,
		buildinSet: buildinSet,
		str2Stream: str2Stream
	};
};
//exports.dependencyTree = dependencyTree;

var BOOT_FUNCTION_PREFIX = '_deps_';
var apiVariableTpl = swig.compileFile(Path.join(__dirname, 'templates', 'apiVariable.js.swig'),
	{autoescape: false});

function JsBundleEntryMaker(api, bundleName, packageBrowserInstances,
	packageSplitPointMap) {
	if (!(this instanceof JsBundleEntryMaker)) {
		return new JsBundleEntryMaker(api, bundleName, packageBrowserInstances,
			packageSplitPointMap);
	}
	this.api = api;
	this.packages = packageBrowserInstances;
	this.bundleName = bundleName;
	this.bundleFileName = bundleName + '_bundle_entry.js';
	this.activeModules = {}; //key: bundle name, value: array of active module name

	this.packageSplitPointMap = packageSplitPointMap;
	// clean split points cache
	this.packages.forEach(packageIns => {
		if (_.has(this.packageSplitPointMap, packageIns.longName)) {
			delete this.packageSplitPointMap[packageIns.longName];
		}
	});
}

var apiVarablePat = /(?:^|[^\w$\.])__api(?:$|[^\w$])/mg;
var requireI18nPat = /(^|[^\w$\.])require\s*\(([^)]*)\)/mg;

JsBundleEntryMaker.prototype = {
	entryBundleFileTpl: swig.compileFile(Path.join(__dirname, 'templates', 'bundle.js.swig'), {autoescape: false}),

	setLocale: function(locale) {
		this.locale = locale;
	},

	createPackageListFile: function() {
		var bundleFileListFunction = this.entryBundleFileTpl({
			bundle: this.bundleName,
			requireFilesFuncName: BOOT_FUNCTION_PREFIX + safeBundleNameOf(this.bundleName),
			packageInstances: this.packages
		});
		return bundleFileListFunction;
	},

	transform: function(locale) {
		var self = this;
		return function(file) {
			var source = '';
			var ext = Path.extname(file).toLowerCase();
			var basename = Path.basename(file);
			if (ext === '.js' && basename !== self.bundleFileName) {
				return through(function(chunk, enc, next) {
					source += chunk;
					next();
				}, function(cb) {
					try {
						this.push(self.transformJS(source, file, locale));
					} catch (e) {
						this.emit('error', e);
					}
					cb();
				});
			} else if (ext === '.html'){
				return through(function(chunk, enc, next) {
					source += chunk;
					next();
				}, function(cb) {
					var currPackage;
					try {
						source = assetsProcesser.replaceAssetsUrl(source, ()=> {
							if (!currPackage) {
								currPackage = self.api.findBrowserPackageByPath(file);
							}
							return currPackage;
						});
						this.push(source);
					} catch (e) {
						this.emit('error', e);
					}
					cb();
				});
			} else {
				return through();
			}
		};
	},

	transformJS: function(source, file, locale) {
		var currPackageName;
		var hasRequireEnsure = false;
		var self = this;
		apiVarablePat.lastIndex = 0;
		if (apiVarablePat.test(source)) {
			log.debug('reference __api in ' + file);
			currPackageName = this.api.findBrowserPackageByPath(file);
			source = apiVariableTpl({
				bundle: this.bundleName,
				packageName: currPackageName,
				source: source,
				packageNameAvailable: currPackageName !== null
			});
		}
		var ast;
		try {
			ast = esParser.parse(source, {
				splitLoad: splitPoint => {
					hasRequireEnsure = true;
					if (!currPackageName) {
						currPackageName = self.api.findBrowserPackageByPath(file);
					}
					if (!_.has(self.packageSplitPointMap, currPackageName)) {
						self.packageSplitPointMap[currPackageName] = {};
					}
					self.packageSplitPointMap[currPackageName][splitPoint] = 1;
				}
			});
		} catch (e) {
			log.error('Failed to parse %s', file);
			throw e;
		}
		//log.error(injector);
		source = injector.injectToFile(file, source, ast);
		if (hasRequireEnsure) {
			source = 'require.ensure = function(){return drApi.ensureRequire.apply(drApi, arguments)};\n' +
				source;
		}
		source = source.replace(requireI18nPat, (match, leading, path) => {
			path = path.replace(/\{locale\}/g, locale ? locale : 'en');
			return leading + 'require(' + path + ')';
		});

		return source;
	},

	createPackageListFileStream: function(bundleName, packageInstances) {
		return str2Stream(this.createPackageListFile.apply(this, arguments));
	}
};

function JsBundleWithI18nMaker(api, bundleName, packageBrowserInstances,
	packageSplitPointMap, browserResolve) {
	if (!(this instanceof JsBundleWithI18nMaker)) {
		return new JsBundleWithI18nMaker(api, bundleName, packageBrowserInstances,
			packageSplitPointMap, browserResolve);
	}
	JsBundleEntryMaker.call(this, api, bundleName, packageBrowserInstances, packageSplitPointMap);
	this.browserResolve = browserResolve;
	this.pk2LocaleModule = {};
}

JsBundleWithI18nMaker.prototype = _.create(JsBundleEntryMaker.prototype, {
	createI18nListFile: function(locale) {
		var i18nModules = [];
		this.i18nModuleForRequire = [];
		this.packages.forEach(pkInstance => {
			if (pkInstance.isVendor) {
				return;
			}
			var i18nPath = this.i18nPath(pkInstance, locale);
			var i18nModuleName = pkInstance.longName + '/i18n';
			if (i18nPath) {
				var shoftI18nPath = Path.relative(Path.resolve(), i18nPath);
				i18nModules.push({
					longName: i18nModuleName
				});
				this.i18nModuleForRequire.push({
					file: i18nPath,
					opts: {
						expose: i18nModuleName
					},
					id: shoftI18nPath
				});
				this.createI18nPackageJson(i18nPath, i18nModuleName, locale);
				if (!this.pk2LocaleModule[i18nModuleName]) {
					this.pk2LocaleModule[i18nModuleName] = {};
				}
				this.pk2LocaleModule[i18nModuleName][locale] = shoftI18nPath;
			}
		});
		if (i18nModules.length === 0) {
			return null;
		}
		return this.entryBundleFileTpl({
			bundle: this.bundleName,
			requireFilesFuncName: '_i18nBundle_' + safeBundleNameOf(this.bundleName),
			packageInstances: i18nModules
		});
	},

	i18nBundleEntryFileName: function(locale) {
		return this.bundleName + '_bundle_entry_' + locale + '.js';
	},

	i18nPath: function(pkInstance, locale) {
		var i18nPath = pkInstance.i18n;
		if (!i18nPath) {
			i18nPath = Path.resolve(pkInstance.packagePath, 'i18n');
			if (!fileExists(i18nPath)) {
				return null;
			}
		}
		i18nPath = Path.resolve(pkInstance.packagePath, i18nPath.replace(/\{locale\}/g, locale));
		if (!fileExists(i18nPath)) {
			log.error('i18n not found: ' + pkInstance.i18n + ' in ' + pkInstance.longName);
			return null;
		}
		return this.browserResolve(i18nPath);
	},

	createI18nPackageJson: function(i18nPath, i18nModuleName, locale) {
		if (this.i18nPackageJsonCreated) {
			return;
		}
		var folder = fs.lstatSync(i18nPath).isDirectory() ? i18nPath : Path.dirname(i18nPath);
		var jsonFile = Path.join(folder, 'package.json');
		var json = {};
		if (!fs.existsSync(jsonFile)) {
			fs.writeFileSync(jsonFile, JSON.stringify(json, null, '  '));
		}
		this.i18nPackageJsonCreated = true;
	}
});
JsBundleWithI18nMaker.prototype.constructor = JsBundleWithI18nMaker;

function safeBundleNameOf(bundleName) {
	return bundleName.replace(/[-\.&#@]/g, '_');
}

function str2Stream(str) {
	var output = new stream.Readable();
	output._read = function() {};
	output.push(str);
	output.push(null);
	return output;
}

function fileExists(file) {
	try {
		fs.accessSync(file, fs.R_OK);
		return true;
	} catch (e) {
		return false;
	}
}
