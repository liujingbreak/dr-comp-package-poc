var through = require('through2');
var Path = require('path');
var stream = require('stream');
var log = require('log4js').getLogger('browserifyBuilder.browserifyHelper');
var _ = require('lodash');
var swig = require('swig');
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
		jsTranform: jsTranform,
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

function jsTranform(file) {
	var source = '';
	var ext = Path.extname(file).toLowerCase();
	if (ext === '.js' && Path.basename(file) !== 'browserifyBuilderApi.browser.js') {
		return through(function(chunk, enc, next) {
			source += chunk;
			next();
		}, function(cb) {
			source = apiVariableTpl({name: file, source: source});
			this.push(source);
			cb();
		});
	} else {
		return through();
	}
}

function JsBundleEntryMaker(bundleName, packageBrowserInstances) {
	if (!(this instanceof JsBundleEntryMaker)) {
		return new JsBundleEntryMaker(bundleName, packageBrowserInstances);
	}
	this.packages = packageBrowserInstances;
	this.bundleName = bundleName;
	this.bundleFileName = bundleName + '_dr_bundle.js';
	this.bundleFileNameSet = {};
	this.activeModules = {}; //key: bundle name, value: array of active module name
}

JsBundleEntryMaker.prototype = {

	BOOT_FUNCTION_PREFIX: BOOT_FUNCTION_PREFIX,

	entryBundleFileTpl: swig.compileFile(Path.join(__dirname, 'templates', 'bundle.js.swig'), {autoescape: false}),

	/**
	 * TODO: use a template engine to generate js file stream
	 */
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
		self.packagePath2Name = {};
		self.packagePathList = [];
		self.packages.forEach(function(instance, idx) {
			if (!instance.packagePath) {
				return;
			}
			var path = Path.relative(config().rootPath, instance.packagePath);
			self.packagePath2Name[path] = instance.longName;
			self.packagePathList.push(path);
		});
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
						var name = self._findPackageByFile(file);
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
			} else {
				return through();
			}
		};
	},

	createPackageListFileStream: function(bundleName, packageInstances) {
		return str2Stream(this.createPackageListFile.apply(this, arguments));
	},

	_findPackageByFile: function(file) {
		var found;
		file = Path.relative(config().rootPath, file);
		_.some(this.packagePathList, function(path) {
			if (_.startsWith(file, path)) {
				found = path;
				return true;
			}
		});
		if (!found) {
			log.debug('file ' + file + ' doesn\'t belong to any of our private packages');
			return null;
		} else {
			return this.packagePath2Name[found];
		}
		return found;
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
