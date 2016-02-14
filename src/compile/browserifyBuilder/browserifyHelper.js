var through = require('through2');
var Path = require('path');
var stream = require('stream');
var log = require('log4js').getLogger('browserifyHelper');

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
		BrowserSideBootstrap: BrowserSideBootstrap,
		buildins: buildins,
		buildinSet: buildinSet,
		str2Stream: str2Stream
	};
};
//exports.dependencyTree = dependencyTree;

var BOOT_FUNCTION_PREFIX = '_bundle_';

function jsTranform(file) {
	log.debug(file);
	var ext = Path.extname(file).toLowerCase();
	if (ext === '.js') {
		return through.obj(function(row, enc, next) {
			//var source = row.contents.toString();
			next(row);
		});
	} else {
		return through();
	}
}

function BrowserSideBootstrap() {
	if (!(this instanceof BrowserSideBootstrap)) {
		return new BrowserSideBootstrap();
	}
	this.bundleScripts = [];
	this.activeModules = {}; //key: bundle name, value: array of active module name
}

BrowserSideBootstrap.prototype = {

	BOOT_FUNCTION_PREFIX: BOOT_FUNCTION_PREFIX,

	/**
	 * TODO: use a template engine to generate js file stream
	 */
	createPackageListFile: function(bundleName, packageInstances) {
		//var self = this;
		this.bundleScripts.push(bundleName);
		var bootScriptFuncName = BOOT_FUNCTION_PREFIX + safeBundleNameOf(bundleName);
		var bootstrap = 'function ' + bootScriptFuncName + '(){\n';
		packageInstances.forEach(function(packageIns) {
			bootstrap += '\trequire(\'' + packageIns.longName + '\');\n';
			// if (packageIns.active) {
			// 	if (!self.activeModules[bundleName]) {
			// 		self.activeModules[bundleName] = [packageIns.longName];
			// 	} else {
			// 		self.activeModules[bundleName].push(packageIns.longName);
			// 	}
			// }
		});
		// if (config().devMode) {
		// 	bootstrap += '\tconsole && console.log("bundle ' + bundleName + ' is activated");\n';
		// }
		bootstrap += '}\n';
		if (config().devMode) {
			bootstrap += 'console && console.log("bundle ' + bundleName + ' is loaded");\n';
		}
		return bootstrap;
		//return str2Stream(bootstrap);
	},

	createPackageListFileStream: function(bundleName, packageInstances) {
		return str2Stream(this.createPackageListFile.apply(this, arguments));
	}
};

function safeBundleNameOf(bundleName) {
	return bundleName.replace('-', '_');
}

function str2Stream(str) {
	var output = new stream.Readable();
	output._read = function() {};
	output.push(str);
	output.push(null);
	return output;
}
