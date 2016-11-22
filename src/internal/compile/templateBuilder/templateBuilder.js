var through = require('through2');
var swig = require('swig');
var Path = require('path');
var fs = require('fs');
var _ = require('lodash');
var defaultOptions = require('./defaultSwigOptions');
var patchText = require('./patch-text.js');
var api = require('__api');
var log = require('log4js').getLogger(api.packageName);
var swigInjectLoader = require('swig-package-tmpl-loader');
var parser = require('./template-parser').parser;
var injector;

exports.compile = function() {
	require('@dr-core/browserify-builder').addTransform(transformFactory);
	injector = require('__injector');
	var translateHtml = require('@dr/translate-generator/translate-replacer').htmlReplacer();
	swigInjectLoader.swigSetup(swig, {
		injector: injector,
		fileContentHandler: function(file, source) {
			return translateHtml(source, file, api.getBuildLocale());
		}
	});
	return null;
};

exports.swig = swig;

exports.testable = {
	preParseTemplate: preParseTemplate
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
				var swigOptionsProm = Promise.resolve(packageExports.onCompileTemplate(
					Path.relative(browserPackage.packagePath, file).replace(/\\/g, '/'),
					swig))
				.then(swigOptions => {
					if (!swigOptions)
						swigOptions = {locals: {}};
					if (!swigOptions.locals)
						swigOptions.locals = {};
					swigOptions.locals.__api = api;
					swigOptions.locals.__renderFile = (targetFile) => {
						return renderFile(targetFile, file, swigOptions);
					};
					return swigOptions;
				});
				return createTransform(swigOptionsProm, file);
			}
		}
	}
	return through();
}

function createTransform(swigOptionsProm, absFile) {
	var str = '';
	return through(function(chunk, enc, next) {
		str += chunk.toString();
		next();
	}, function(next) {
		swigOptionsProm.then(swigOptions => {
			var opt = _.assign(_.clone(defaultOptions), {cache: false}, swigOptions);
			swig.setDefaults(opt);
			try {
				var compiled = swig.render(str, {filename: absFile});
				this.push(compiled);
			} catch (e) {
				log.error('failed to compile %s:\n%s', absFile, str);
				log.error(e);
				this.emit('error', e);
			}
			next();
		});
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

var includeTemplCache = {};
/**
 * Unlike Swig include tag, this function accept file path as variable
 */
function renderFile(filePath, fromFile, swigOptions) {
	if (filePath.startsWith('npm://')) {
		filePath = swigInjectLoader.resolveTo(filePath, fromFile, injector);
	}
	if (!filePath) {
		log.warn('Empty __renderFile() file path in %s', fromFile);
		return;
	}
	var str = fs.readFileSync(Path.resolve(Path.dirname(fromFile), filePath), 'utf8');
	var absFile = Path.resolve(fromFile);
	var template = includeTemplCache[absFile];
	if (!template)
		template = swig.compile(str, {filename: Path.resolve(fromFile)}, {autoescape: false});
	return template(swigOptions.locals);
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
