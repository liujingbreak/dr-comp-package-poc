var through = require('through2');
var swig = require('swig');
var Path = require('path');
var _ = require('lodash');
var defaultOptions = require('./defaultSwigOptions');
var api = require('__api');
var injector = require('__injector');
var log = require('log4js').getLogger(api.packageName);


module.exports = {
	compile: function() {
		api.builder.addTransform(transformFactory);
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
		//log.debug(compiled);
		this.push(compiled);
		next();
	});
}

function runPackage(packageIns, file) {
	if (!_.has(packageCache, packageIns.longName)) {
		try {
			var exports = require(packageIns.longName);
			packageCache[packageIns.longName] = exports;
		} catch (err) {
			log.warn(err, err.stack);
			return null;
		}
	}
	return packageCache[packageIns.longName];
}
