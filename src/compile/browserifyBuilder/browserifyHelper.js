var through = require('through2');
var Path = require('path');
var stream = require('stream');
var log = require('log4js').getLogger('browserifyHelper');
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

function JsBundleEntryMaker(bundleName) {
	if (!(this instanceof JsBundleEntryMaker)) {
		return new JsBundleEntryMaker(bundleName);
	}
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
	createPackageListFile: function(packageInstances) {
		log.debug('create pacakge list for ' + this.bundleName);
		var bundleFileListFunction = this.entryBundleFileTpl({
			requireFilesFuncName: BOOT_FUNCTION_PREFIX + safeBundleNameOf(this.bundleName),
			packageInstances: packageInstances
		});
		this.bundleFileNameSet[this.bundleFileName] = true;
		return bundleFileListFunction;
	},

	jsTranformFactory: function() {
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
					log.trace(basename + ' is injected with API variable');
					source = apiVariableTpl({name: file, source: source});
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
