var EventEmitter = require('events');
var config = require('./config');
var packageUitls = require('./packageMgr/packageUtils');
var _ = require('lodash');

module.exports = NodeApi;

function NodeApi(name, packageInstance) {
	this.packageName = name;
	this.packageShortName = packageUitls.parseName(name).name;
	this.packageInstance = packageInstance;
	this.contextPath = this._contextPath();
}

NodeApi.prototype = {
	buildUtils: require('./gulp/buildUtils'),
	packageUtils: require('./packageMgr/packageUtils'),
	compileNodePath: [config().nodePath],
	eventBus: new EventEmitter(),
	config: config,

	isBrowser: function() {
		return false;
	},

	isNode: function() {
		return true;
	},

	assetsUrl: function(packageName, path) {
		if (arguments.length === 1) {
			path = packageName;
			packageName = this.packageName;
		}
		if (_.startsWith(path, '/')) {
			path = path.substring(1);
		}
		var staticAssetsURL = this.config().staticAssetsURL;
		staticAssetsURL = _.trimEnd(staticAssetsURL, '/');
		var outputPath = config.get('outputPathMap.' + packageName);
		if (outputPath != null)
			outputPath = _.trim(outputPath, '/');
		else
			outputPath = packageUitls.parseName(packageName).name;
		return staticAssetsURL + ('/' + outputPath + '/' + path).replace(/\/\//g, '/');
	},

	/**
	 * join contextPath
	 * @return {[type]} [description]
	 */
	joinContextPath: function(path) {
		return (this.contextPath + '/' + path).replace(/\/\//g, '/');
	},

	_contextPath: function() {
		var path = config.get('packageContextPathMapping[' + this.packageShortName + ']') ||
			config.get(['packageContextPathMapping', this.packageName]);
		path = path != null ? path : '/' + this.packageShortName;
		if (this.config().nodeRoutePath) {
			path = this.config().nodeRoutePath + '/' + path;
		}
		return path.replace(/\/\/+/g, '/');
	},

	/**
	 * [entryPageUrl description]
	 * @param  {string} packageName      optional, default is current package
	 * @return {string}                  [description]
	 */
	entryPageUrl: function(packageName, relativePagePath) {
		if (relativePagePath.startsWith('npm://'))
			relativePagePath = /npm:\/\/(?:@[^\/]+\/)?[^\/]+\/(.+)/.exec(relativePagePath)[1];
		if (!packageName)
			packageName = this.packageName;
		var parsedName = this.parsePackageName(packageName);
		var mappedTo = _.get(this.config(), ['outputPathMap', parsedName.name]) || _.get(this.config(), ['outputPathMap', packageName]);
		if (mappedTo != null)
			mappedTo = _.trim(mappedTo, '/');
		var url = this.config().staticAssetsURL;
		if (!this.config().staticAssetsURL.endsWith('/'))
			url += '/';
		if (mappedTo != null) {
			if (mappedTo.length > 0)
				url += mappedTo + '/';
		} else {
			url += parsedName.name + '/';
		}
		return url + relativePagePath;
	},

	parsePackageName: function(packageName) {
		return this.packageUtils.parseName(packageName);
	},

	getBuildLocale: function() {
		return this.argv.locale || this.config.get('locales[0]');
	},

	localeBundleFolder: function() {
		return this.config.get('locales[0]') === this.getBuildLocale() ? '' : this.getBuildLocale() + '/';
	},

	isDefaultLocale: function() {
		return this.config.get('locales[0]') === this.getBuildLocale();
	}
};
