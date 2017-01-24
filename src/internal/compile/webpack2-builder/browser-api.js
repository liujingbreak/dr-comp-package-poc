/* globals define:true */
if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {
	// To avoid lodash conflict with some AMD build optimizers
	var oldDefine = define;
	define = null;
	require('lodash');
	define = oldDefine;
}

var _ = require('lodash');
var resolveUrl = require('@dr-core/browserify-builder-api/resolveUrl');
// var bundleLoader = require('@dr-core/bundle-loader');
// var loadCssBundles = bundleLoader.loadCssBundles;
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
		}
		return resolveUrl(this.config, packageName, path);
	},

	getPrefLanguage: function() {
		var availables = this.config().locales;

		var chooseLang = [
			navigator.language,
			navigator.browserLanguage,
			navigator.systemLanguage,
			navigator.userLanguage
		];
		if (navigator.languages  && navigator.languages.length > 0) {
			chooseLang.unshift(navigator.languages[0]);
		}

		if (navigator.languages && navigator.languages.length > 1) {
			chooseLang = chooseLang.concat(navigator.languages.slice(1));
		}
		var pref;
		if (!_.some(chooseLang, function(language) {
			if (language && _.includes(availables, language)) {
				pref = language;
				return true;
			}
			return false;
		})) {
			_.some(chooseLang, function(language) {
				var forbackLang = /[a-zA-Z]*/.exec(language);
				forbackLang = forbackLang ? forbackLang[0] : false;
				if (forbackLang && _.includes(availables, forbackLang)) {
					pref = forbackLang;
					return true;
				}
			});
		}
		pref = pref ? pref : 'en';
		return pref;
	},

	getLocaleUrl: function(lang) {
		lang = _.trim(lang, '/');
		var url;
		if (lang === this.config.get('locales[0]', 'zh'))
			url = this.config().staticAssetsURL + location.pathname;
		else
			url = this.config().staticAssetsURL + '/' + lang + location.pathname;
		return url;
	},

	reloadToLocale: function(lang) {
		if (!this.isInDefaultLocale())
			return false;
		lang = _.trim(lang, '/');
		if (this.buildLocale !== lang) {
			window.location = this.getLocaleUrl(lang);
			return true;
		}
		return false;
	},

	isInDefaultLocale: function() {
		return this.buildLocale === this.config.get('locales[0]', 'zh');
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
	}
};

BrowserApi.prototype.config.set = function(path, value) {
	_.set(BrowserApi.prototype._config, path, value);
	return BrowserApi.prototype._config;
};

BrowserApi.prototype.config.get = function(propPath, defaultValue) {
	return _.get(BrowserApi.prototype._config, propPath, defaultValue);
};
