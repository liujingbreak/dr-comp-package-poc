var through = require('through2');
var swig = require('swig');
var Path = require('path');
var _ = require('lodash');
var defaultOptions = require('./defaultSwigOptions');
var api = require('__api');
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
		opt.filename = absFile;
		var compiled = swig.render(str, opt);
		//log.debug(compiled);
		this.push(compiled);
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
