var through = require('through2');
var Path = require('path');
var stream = require('stream');
var log = require('log4js').getLogger('browserifyBuilder.browserifyHelper');
var swig = require('swig');
var fs = require('fs');
var assetsProcesser = require('@dr-core/assets-processer');
var _ = require('lodash');
var glob = require('glob');
swig.setDefaults({autoescape: false});
var config;

module.exports = function(_config) {
	config = _config;

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

var BOOT_FUNCTION_PREFIX = '_bundle_';
var apiVariableTpl = swig.compileFile(Path.join(__dirname, 'templates', 'apiVariable.js.swig'),
	{autoescape: false});

function JsBundleEntryMaker(api, bundleName, packageBrowserInstances, locale) {
	if (!(this instanceof JsBundleEntryMaker)) {
		return new JsBundleEntryMaker(api, bundleName, packageBrowserInstances, locale);
	}
	this.api = api;
	this.packages = packageBrowserInstances;
	this.bundleName = bundleName;
	this.bundleFileName = bundleName + '_bundle_entry.js';
	this.activeModules = {}; //key: bundle name, value: array of active module name
	this.locale = locale;
}

var apiVarablePat = /(?:^|[^\w$\.])__api(?:$|[^\w$])/mg;
var requireI18nPat = /(^|[^\w$\.])require\s*\(([^)]*)\)/mg;

JsBundleEntryMaker.prototype = {
	entryBundleFileTpl: swig.compileFile(Path.join(__dirname, 'templates', 'bundle.js.swig'), {autoescape: false}),

	createPackageListFile: function() {
		var bundleFileListFunction = this.entryBundleFileTpl({
			bundle: this.bundleName,
			requireFilesFuncName: BOOT_FUNCTION_PREFIX + safeBundleNameOf(this.bundleName),
			packageInstances: this.packages
		});
		return bundleFileListFunction;
	},

	jsTranformer: function() {
		var self = this;
		return function(file) {
			var source = '';
			var ext = Path.extname(file).toLowerCase();
			var basename = Path.basename(file);
			if (ext === '.js' && basename !== 'browserifyBuilderApi.browser.js' &&
				basename !== self.bundleFileName) {
				return through(function(chunk, enc, next) {
					source += chunk;
					next();
				}, function(cb) {
					apiVarablePat.lastIndex = 0;
					if (apiVarablePat.test(source)) {
						log.debug('reference __api in ' + file);
						var name = self.api.findBrowserPackageByPath(file);
						source = apiVariableTpl({
							bundle: self.bundleName,
							packageName: name,
							source: source,
							packageNameAvailable: name !== null
						});
					}
					source = source.replace(requireI18nPat, (match, leading, path) => {
						path = path.replace(/\{locale\}/g, self.locale ? self.locale : 'en');
						return leading + 'require(' + path + ')';
					});
					this.push(source);
					cb();
				});
			} else if (ext === '.html'){
				return through(function(chunk, enc, next) {
					source += chunk;
					next();
				}, function(cb) {
					var currPackage;
					source = assetsProcesser.replaceAssetsUrl(source, ()=> {
						if (!currPackage) {
							currPackage = self.api.findBrowserPackageByPath(file);
						}
						return currPackage;
					});
					this.push(source);
					cb();
				});
			} else {
				return through();
			}
		};
	},

	createPackageListFileStream: function(bundleName, packageInstances) {
		return str2Stream(this.createPackageListFile.apply(this, arguments));
	}
};

function JsBundleWithI18nMaker(api, bundleName, packageBrowserInstances, browserResolve) {
	if (!(this instanceof JsBundleWithI18nMaker)) {
		return new JsBundleWithI18nMaker(api, bundleName, packageBrowserInstances, browserResolve);
	}
	JsBundleEntryMaker.apply(this, arguments);
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
	return bundleName.replace(/-/g, '_');
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
