var Promise = require('bluebird');
var fs = require('fs');

var readFileAsync = Promise.promisify(fs.readFile);

exports.activate = function(api) {
	var apiProto = Object.getPrototypeOf(api);
	apiProto.getCompiledViewPath = function(packageRelativePath) {
		return '/' + this.config().destDir + '/server/' + this.packageShortName + '/' + packageRelativePath;
	};
	apiProto.entryJsHtmlFile = function(entryViewPath) {
		if (!entryViewPath)
			throw new Error('missing entryViewPath');
		return this.config.resolve('destDir', 'entryFragment', this.packageName, entryViewPath + '.js.html');
	};
	apiProto.entryStyleHtmlFile = function(entryViewPath) {
		if (!entryViewPath)
			throw new Error('missing entryViewPath');
		return this.config.resolve('destDir', 'entryFragment', this.packageName, entryViewPath + '.style.html');
	};
	apiProto.entryJsHtmlAsync = function(entryViewPath) {
		if (!entryViewPath)
			throw new Error('missing entryViewPath');
		return readFileAsync(this.config.resolve('destDir', 'entryFragment', this.packageName, entryViewPath + '.js.html'), 'utf8');
	};
	apiProto.entryStyleHtmlAsync = function(entryViewPath) {
		if (!entryViewPath)
			throw new Error('missing entryViewPath');
		return readFileAsync(this.config.resolve('destDir', 'entryFragment', this.packageName, entryViewPath + '.style.html'), 'utf8');
	};

	apiProto.entryJsHtml = function(entryViewPath) {
		if (!entryViewPath)
			throw new Error('missing entryViewPath');
		console.log(this.config.resolve('destDir', 'entryFragment', this.packageName, entryViewPath + '.js.html'));
		return fs.readFileSync(this.config.resolve('destDir', 'entryFragment', this.packageName, entryViewPath + '.js.html'), 'utf8');
	};
	apiProto.entryStyleHtml = function(entryViewPath) {
		if (!entryViewPath)
			throw new Error('missing entryViewPath');
		return fs.readFileSync(this.config.resolve('destDir', 'entryFragment', this.packageName, entryViewPath + '.style.html'), 'utf8');
	};
};

exports.resolveUrl = require('./resolveUrl');
