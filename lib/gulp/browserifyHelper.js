var through = require('through2');
var Path = require('path');
var stream = require('stream');
var config = require('../config');

exports.textHtml = textHtmlTranform;
exports.BrowserSideBootstrap = BrowserSideBootstrap;

var BOOT_FUNCTION_PREFIX = 'bootBundle_';

function textHtmlTranform(file) {
	var ext = Path.extname(file).toLowerCase();
	if (ext === '.html' || ext === '.txt') {
		return through(function(buf, encoding, next) {
			this.push('module.exports = ' + JSON.stringify(buf.toString('utf-8')));
			next();
		});
	} else {
		return through(doNothing);
	}
}

function doNothing(buf, encoding, next) {
	this.push(buf);
	next();
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

	createBundleEntryFile: function(bundleName, moduleInfos) {
		var self = this;
		this.bundleScripts.push(bundleName);
		var bootstrap = 'function ' + BOOT_FUNCTION_PREFIX + bundleName + '(){\n';
		moduleInfos.forEach(function(moduleInfo) {
			bootstrap += '\trequire(\'' + moduleInfo.longName + '\');\n';
			if (moduleInfo.active) {
				if (!self.activeModules[bundleName]) {
					self.activeModules[bundleName] = [moduleInfo.longName];
				} else {
					self.activeModules[bundleName].push(moduleInfo.longName);
				}
			}
		});
		if (config().devMode) {
			bootstrap += '\tconsole && console.log("bundle ' + bundleName + ' is activated")';
		}
		bootstrap += '}\n';
		if (config().devMode) {
			bootstrap += 'console && console.log("bundle ' + bundleName + ' is loaded")';
		}
		var output = new stream.Readable();
		output._read = function() {};
		output.push(bootstrap);
		output.push(null);
		return output;
	}
};
