var through = require('through2');
var Path = require('path');
var stream = require('stream');
var esprima = require('esprima');
var estraverse = require('estraverse');
var fs = require('fs');

var config;

module.exports = function(_config) {
	config = _config;
	return {
		textHtmlTranform: textHtmlTranform,
		BrowserSideBootstrap: BrowserSideBootstrap
	};
};
//exports.dependencyTree = dependencyTree;

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

	/**
	 * TODO: use a template engine to generate js file stream
	 */
	createPackageListFile: function(bundleName, packageInstances) {
		var self = this;
		this.bundleScripts.push(bundleName);
		var bootstrap = 'function ' + BOOT_FUNCTION_PREFIX + bundleName + '(){\n';
		packageInstances.forEach(function(packageIns) {
			bootstrap += '\trequire(\'' + packageIns.longName + '\')' +
				(packageIns.active ? '.activate();\n' : ';\n');
			if (packageIns.active) {
				if (!self.activeModules[bundleName]) {
					self.activeModules[bundleName] = [packageIns.longName];
				} else {
					self.activeModules[bundleName].push(packageIns.longName);
				}
			}
		});
		if (config().devMode) {
			bootstrap += '\tconsole && console.log("bundle ' + bundleName + ' is activated");\n';
		}
		bootstrap += '}\n';
		if (config().devMode) {
			bootstrap += 'console && console.log("bundle ' + bundleName + ' is loaded");\n';
		}
		var output = new stream.Readable();
		output._read = function() {};
		output.push(bootstrap);
		output.push(null);
		return str2Stream(bootstrap);
	}
};

function str2Stream(str) {
	var output = new stream.Readable();
	output._read = function() {};
	output.push(str);
	output.push(null);
	return output;
}

// function dependencyTree(filePath) {
// 	console.log('read ' + filePath);
// 	var ast = esprima.parse(fs.readFileSync(filePath, 'utf-8'));
// 	console.log(ast);
// 	estraverse.traverse(ast, {
// 		enter: function(node) {
// 			if (node.type === 'CallExpression' && node.callee && node.callee.type === 'Identifier' &&
// 				node.callee.name === 'require') {
// 				console.log(node.arguments[0].value);
// 			}
// 		}
// 	});
// }
//
// if (process.argv.length >= 3) {
// 	dependencyTree(process.argv[2]);
// }
