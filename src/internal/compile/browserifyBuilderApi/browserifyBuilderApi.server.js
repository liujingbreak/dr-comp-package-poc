var Promise = require('bluebird');
var fs = require('fs');

var readFileAsync = Promise.promisify(fs.readFile);

exports.activate = function(api) {
	var apiProto = Object.getPrototypeOf(api);
	apiProto.getCompiledViewPath = function(packageRelativePath, locale) {
		locale = locale ? locale + '/' : '';
		return '/' + this.config().destDir + '/server/' + locale + this.packageShortName + '/' + packageRelativePath;
	};
	apiProto.entryJsHtmlFile = function(entryViewPath, locale) {
		if (!entryViewPath)
			throw new Error('missing entryViewPath');
		locale = locale || api.config.get('locales')[0];
		return this.config.resolve('destDir', 'entryFragment', locale, this.packageName, entryViewPath + '.js.html');
	};
	apiProto.entryStyleHtmlFile = function(entryViewPath, locale) {
		if (!entryViewPath)
			throw new Error('missing entryViewPath');
		locale = locale || api.config.get('locales')[0];
		return this.config.resolve('destDir', 'entryFragment', locale, this.packageName, entryViewPath + '.style.html');
	};
	apiProto.entryJsHtmlAsync = function(entryViewPath, locale) {
		if (!entryViewPath)
			throw new Error('missing entryViewPath');
		locale = locale || api.config.get('locales')[0];
		return readFileAsync(this.config.resolve('destDir', 'entryFragment', locale, this.packageName, entryViewPath + '.js.html'), 'utf8');
	};
	apiProto.entryStyleHtmlAsync = function(entryViewPath, locale) {
		if (!entryViewPath)
			throw new Error('missing entryViewPath');
		locale = locale || api.config.get('locales')[0];
		return readFileAsync(this.config.resolve('destDir', 'entryFragment', locale, this.packageName, entryViewPath + '.style.html'), 'utf8');
	};

	apiProto.entryJsHtml = function(entryViewPath, locale) {
		if (!entryViewPath)
			throw new Error('missing entryViewPath');
		locale = locale || api.config.get('locales')[0];
		return fs.readFileSync(this.config.resolve('destDir', 'entryFragment', locale, this.packageName, entryViewPath + '.js.html'), 'utf8');
	};
	apiProto.entryStyleHtml = function(entryViewPath, locale) {
		if (!entryViewPath)
			throw new Error('missing entryViewPath');
		locale = locale || api.config.get('locales')[0];
		return fs.readFileSync(this.config.resolve('destDir', 'entryFragment', locale, this.packageName, entryViewPath + '.style.html'), 'utf8');
	};
};

exports.resolveUrl = require('./resolveUrl');
