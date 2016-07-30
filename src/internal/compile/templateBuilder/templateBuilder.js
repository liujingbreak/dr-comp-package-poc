var through = require('through2');
var swig = require('swig');
var Path = require('path');
var _ = require('lodash');
var defaultOptions = require('./defaultSwigOptions');
var patchText = require('./patch-text.js');
var api = require('__api');
var log = require('log4js').getLogger(api.packageName);
var swigInjectLoader = require('swig-package-tmpl-loader');
var parser = require('./template-parser').parser;

module.exports = {
	compile: function() {
		var injector = require('__injector');
		swigInjectLoader.swigSetup(swig, {injector: injector});
		require('@dr-core/browserify-builder').addTransform(transformFactory);
		return null;
	},
	swig: swig,
	testable: {
		preParseTemplate: preParseTemplate
	}
};

var packageCache = {};

function transformFactory(file) {
	var ext = Path.extname(file).toLowerCase();
	if (ext === '.html' || ext === '.swig') {
		var browserPackage = api.findBrowserPackageInstanceByPath(file);
		if (browserPackage) {
			var packageExports = runPackage(browserPackage, file);
			if (packageExports && _.isFunction(packageExports.onCompileTemplate)) {
				log.debug('is template: ', file);
				var swigOptions = packageExports.onCompileTemplate(
					Path.relative(browserPackage.packagePath, file).replace(/\\/g, '/'),
					swig);
				if (swigOptions) {
					return createTransform(swigOptions, file);
				}
			}
		}
	}
	return through();
}

function createTransform(swigOptions, absFile) {
	var str = '';
	return through(function(chunk, enc, next) {
		str += chunk.toString();
		next();
	}, function(next) {
		var opt = _.assign(_.clone(defaultOptions), swigOptions);
		swig.setDefaults(opt);
		try {
			var compiled = swig.render(str, {filename: absFile});
			//log.debug(compiled);
			this.push(compiled);
		} catch (e) {
			log.error('failed to compile %s:\n%s', absFile, str);
			this.emit('error', e);
		}
		next();
	});
}

function runPackage(browserPackage, file) {
	if (!_.has(packageCache, browserPackage.longName)) {
		try {
			var exports = require(browserPackage.longName);
			packageCache[browserPackage.longName] = exports;
		} catch (err) {
			// MODULE_NOT_FOUND meaning the package has no `main` entry module, skip it
			if (err.code !== 'MODULE_NOT_FOUND')
				log.warn('require ', browserPackage.longName, err, err.stack);
			return null;
		}
	}
	return packageCache[browserPackage.longName];
}

/**
 * @Deprecated
 * [preParseTemplate description]
 * @param  {string} str            template content
 * @param  {function} replaceHandler function(toReplacePath, templatePath)
 * @return {string}                new template content
 */
function preParseTemplate(templatePath, str, replaceHandler) {
	parser.lexer.options.ranges = true;
	var nodes = parser.parse(str);
	var textPatches = [];
	nodes.forEach(node => {
		if (node.name === 'include' || node.name === 'import') {
			var value = node.attr.value;
			value = (_.startsWith(value, '"') || _.startsWith(value, '\'')) ?
				value.substring(1, value.length - 1) : value;
			var replaced = replaceHandler(value, templatePath);
			if (replaced !== undefined && replaced !== null) {
				textPatches.push({
					start: node.attr.loc.range[0],
					end: node.attr.loc.range[1],
					replacement: '"' + replaced + '"'
				});
				log.debug('line: ', node.loc.lineno, ' replace ', node.name, ' file path ', node.attr.value, ' to ', replaced);
			}
		}
	});
	return patchText(str, textPatches);
}
