var through = require('through2');
var Path = require('path');
var _ = require('lodash');
var api = require('__api');
var handlebars = require('handlebars');
var layouts = require('handlebars-layouts');
var log = require('log4js').getLogger(api.packageName);

require('@dr-core/browserify-builder').addTransform(transformFactory);

module.exports = {
	compile: function() {
		//var injector = require('__injector');
		handlebars.registerHelper(layouts(handlebars));
		return null;
	},
	handlebars: handlebars
};

function transformFactory(file) {
	if (file.endsWith === '.hbs.html' || file.endsWith === '.hbs') {
		var browserPackage = api.findBrowserPackageInstanceByPath(file);
		if (browserPackage) {
			var packageExports = runPackage(browserPackage, file);
			if (packageExports && _.isFunction(packageExports.onHandlebarsTemplate)) {
				log.debug('is template: ', file);
				var context = packageExports.onHandlebarsTemplate(
					Path.relative(browserPackage.packagePath, file).replace(/\\/g, '/'),
					handlebars);
				return createTransform(file, context);
			}
		}
	}
	return through();
}

function createTransform(absFile, context) {
	var str = '';
	return through(function(chunk, enc, next) {
		str += chunk.toString();
		next();
	}, function(next) {
		try {
			var compiled = handlebars.compile(str)(context);
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
	try {
		var exports = require(browserPackage.longName);
		return exports;
	} catch (err) {
		// MODULE_NOT_FOUND meaning the package has no `main` entry module, skip it
		if (err.code !== 'MODULE_NOT_FOUND')
			log.warn('require ', browserPackage.longName, err, err.stack);
		return null;
	}
}
