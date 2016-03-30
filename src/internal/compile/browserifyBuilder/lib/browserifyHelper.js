var through = require('through2');
var Path = require('path');
var stream = require('stream');
var log = require('log4js').getLogger('browserifyBuilder.browserifyHelper');
var swig = require('swig');
var assetsProcesser = require('@dr-core/assets-processer');
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
		buildins: buildins,
		buildinSet: buildinSet,
		str2Stream: str2Stream
	};
};
//exports.dependencyTree = dependencyTree;

var BOOT_FUNCTION_PREFIX = '_bundle_';
var apiVariableTpl = swig.compileFile(Path.join(__dirname, 'templates', 'apiVariable.js.swig'),
	{autoescape: false});

function JsBundleEntryMaker(api, bundleName, packageBrowserInstances) {
	if (!(this instanceof JsBundleEntryMaker)) {
		return new JsBundleEntryMaker(api, bundleName, packageBrowserInstances);
	}
	this.api = api;
	this.packages = packageBrowserInstances;
	this.bundleName = bundleName;
	this.bundleFileName = bundleName + '_dr_bundle.js';
	this.bundleFileNameSet = {};
	this.activeModules = {}; //key: bundle name, value: array of active module name
}

JsBundleEntryMaker.prototype = {

	BOOT_FUNCTION_PREFIX: BOOT_FUNCTION_PREFIX,

	entryBundleFileTpl: swig.compileFile(Path.join(__dirname, 'templates', 'bundle.js.swig'), {autoescape: false}),

	createPackageListFile: function() {
		var self = this;
		var bundleFileListFunction = this.entryBundleFileTpl({
			bundle: self.bundleName,
			requireFilesFuncName: BOOT_FUNCTION_PREFIX + safeBundleNameOf(this.bundleName),
			packageInstances: self.packages
		});
		this.bundleFileNameSet[this.bundleFileName] = true;
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
					if (source.indexOf('__api') >= 0) {
						log.debug('reference __api in ' + file);
						var name = self.api.findBrowserPackageByPath(file);
						source = apiVariableTpl({
							bundle: self.bundleName,
							packageName: name,
							source: source,
							packageNameAvailable: name !== null
						});
					}
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
