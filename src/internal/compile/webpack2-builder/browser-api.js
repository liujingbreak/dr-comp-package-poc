/* globals LEGO_CONFIG:true */
// if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {
// 	// To avoid lodash conflict with some AMD build optimizers
// 	var oldDefine = define;
// 	define = null;
// 	require('lodash');
// 	define = oldDefine;
// }

var _ = require('lodash');
window._ = _;
module.exports = BrowserApi;

var packageNameReg = /(?:@([^\/]+)\/)?(\S+)/;

function BrowserApi(packageName, bundleName) {
	if (!(this instanceof BrowserApi)) {
		return new BrowserApi(packageName, bundleName);
	}
	this.packageName = packageName;
	var m = packageNameReg.exec(packageName);
	this.packageShortName = m[2];
	this.bundle = bundleName;

	var path = this.config.get(['packageContextPathMapping', this.packageShortName]);
	path = path != null ? path : '/' + this.packageShortName;
	if (this.config)
		this.contextPath = this.config().serverURL + path;
	BrowserApi.packageApiMap[packageName] = this;
}

BrowserApi.setup = function(obj) {
	_.assign(BrowserApi.prototype, obj);
};

BrowserApi.packageApiMap = {}; // Cache browser side API instance by package name
BrowserApi.getCachedApi = function(name) {
	return _.get(BrowserApi.packageApiMap, name);
};

BrowserApi.prototype = {
	i18nLoaded: false,
	_config: LEGO_CONFIG,
	buildLocale: LEGO_CONFIG.buildLocale,

	entryPage: __drcpEntryPage,
	entryPackage: window.__drcpEntryPackage,

	config: function() {
		return BrowserApi.prototype._config;
	},

	isDebug: function() {
		return this.config().devMode;
	},

	isBrowser: function() {
		return true;
	},

	isNode: function() {
		return false;
	},

	assetsUrl: function(packageName, path) {
		if (arguments.length === 1) {
			path = packageName;
			packageName = this.packageShortName;
			var m = /assets:\/\/((?:@[^\/]+\/)?[^\/]+)?(\/.*)/.exec(path);
			if (m) {
				packageName = m[1];
				path = m[2];
			}
		}
		//return resolveUrl(this.config, packageName, path);

		if (path.charAt(0) === '/') {
			path = path.substring(1);
		}
		var staticAssetsURL = this.config().staticAssetsURL;
		while (staticAssetsURL.charAt(staticAssetsURL.length - 1) === '/') {
			staticAssetsURL = staticAssetsURL.substring(0, staticAssetsURL.length - 1);
		}
		//staticAssetsURL += this.isDefaultLocale() ? '' : '/' + this.getBuildLocale();

		var outputPath = this.config().outputPathMap[packageName];
		if (outputPath != null)
			outputPath = _.trim(outputPath, '/');
		else
			outputPath = /(?:@([^\/]+)\/)?(\S+)/.exec(packageName)[2];
		return staticAssetsURL + ('/' + outputPath + '/' + path).replace(/\/\//g, '/');
	},

	extend: function(obj) {
		_.assign(BrowserApi.prototype, obj);
	},

	isPackageLoaded: function(packageName) {
		return _.has(this.loadedPackage, packageName);
	},

	markBundleLoaded: function(bundles) {
		var self = this;
		if (!self.loadedBundleFileSet) {
			// if loadedBundleFileSet is undefined, it means that there is no
			// split points, no need to track loaded bundles
			return;
		}
		bundles = [].concat(bundles);
		_.each(bundles, function(b) {
			self.loadedBundleFileSet[b] = 1;
		});
	},

	/**
	 * Parse window.location.search to a hash object
	 */
	urlSearchParam: function(searchString) {
		var searchMap = {};
		var search = searchString ? searchString : window.location.search;
		if (search && search.length > 0) {
			if (_.startsWith(search, '?'))
				search = search.substring(1);
			_.each(search.split('&'), function(qs) {
				var pair = qs.split('=');
				searchMap[pair[0]] = pair[1];
			});
		}
		return searchMap;
	},

	_addCssScopeClassname: function(classnames) {
		var htmlDom = document.getElementsByTagName('html')[0];
		classnames = [].concat(classnames);
		for (var i = 0, l = classnames.length; i < l; i++) {
			var cls = classnames[i];
			var r = new RegExp('(?:^|\\s)' + cls + '(?:$|\\s)');
			if (!r.test(htmlDom.className))
				htmlDom.className += ' ' + cls;
		}
	}
};

BrowserApi.prototype.config.set = function(path, value) {
	_.set(BrowserApi.prototype._config, path, value);
	return BrowserApi.prototype._config;
};

BrowserApi.prototype.config.get = function(propPath, defaultValue) {
	return _.get(BrowserApi.prototype._config, propPath, defaultValue);
};

_.assign(BrowserApi.prototype, require('@dr-core/browserify-builder-api/i18n-api'));
