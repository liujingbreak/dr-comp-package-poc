var through = require('through2');
var browserifyBuilder = require('@dr-core/browserify-builder');
var swig = require('swig');
var Path = require('path');
var _ = require('lodash');
var defaultOptions = require('./defaultSwigOptions');
var log = require('log4js').getLogger(Path.basename(__filename, '.js'));
var api;

module.exports = {
	compile: function(_api) {
		api = _api;
		browserifyBuilder.addTransform(transformFactory);
		return null;
	},
	swig: swig
};

var packageCache = {};

function transformFactory(file) {
	var ext = Path.extname(file).toLowerCase();
	if (ext === '.html' || ext === '.swig') {
		var packageIns = api.findBrowserPackageInstanceByPath(file);
		var packageExports = runPackage(packageIns, file);
		if (packageExports && _.isFunction(packageExports.onCompileTemplate)) {
			log.debug('found file: ' + file);
			var swigOptions = packageExports.onCompileTemplate(
				Path.relative(packageIns.packagePath, file).replace(/\\/g, '/'),
				swig);
			if (swigOptions) {
				return createTransform(swigOptions, file);
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
		opt.filename = absFile;
		var compiled = swig.render(str, opt);
		this.push(compiled);
		next();
	});
}

function runPackage(packageIns, file) {
	if (!{}.hasOwnProperty.call(packageCache, packageIns.longName)) {
		try {
			var exports = require(packageIns.longName);
			packageCache[packageIns.longName] = exports;
		} catch (err) {
			return null;
		}
	}
	return packageCache[packageIns.longName];
}
