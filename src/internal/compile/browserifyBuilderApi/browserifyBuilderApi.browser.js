var resolveUrl = require('./resolveUrl');
var _ = require('lodash');
module.exports = BrowserApi;

var packageNameReg = /(?:@([^\/]+)\/)?(\S+)/;

window.t = function(text) {
	return text;
};

var Promise = require('bluebird');
Promise.defer = defer;

function defer() {
	var resolve, reject;
	var promise = new Promise(function() {
		resolve = arguments[0];
		reject = arguments[1];
	});
	return {
		resolve: resolve,
		reject: reject,
		promise: promise
	};
}

function BrowserApi(packageName, bundleName) {
	if (!(this instanceof BrowserApi)) {
		return new BrowserApi(packageName);
	}
	this.packageName = packageName;
	var m = packageNameReg.exec(packageName);
	this.packageShortName = m[2];
	this.bundle = bundleName;

	var path = this.config().packageContextPathMapping[this.packageShortName];
	path = path != null ? path : '/' + this.packageShortName;

	this.contextPath = this.config().serverURL + path;
}

BrowserApi.setup = function(obj) {
	_.assign(BrowserApi.prototype, obj);
};

BrowserApi.prototype = {
	config: function() {
		return BrowserApi.prototype._config;
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

	loadLocaleBundles: function(locale, waitCallback) {
		var prefix = this.config().staticAssetsURL;
		var localeBundles = this.localeBundlesMap[locale];
		var localeBundleUrls = _.map(localeBundles, function(bundle) {
			return prefix + '/' + bundle;
		});
		window.$LAB.script(localeBundleUrls).wait(waitCallback);
	},

	loadPrefLocaleBundles: function(waitCallback) {
		var availables = this.config().locales;
		var chooseLang = [
			navigator.languages[0],
			navigator.language,
			navigator.browserLanguage,
			navigator.systemLanguage,
			navigator.userLanguage
		];
		if (navigator.languages.length > 1) {
			chooseLang = chooseLang.concat(navigator.languages.slice(1));
		}

		var pref;
		_.some(chooseLang, function(language) {
			if (language && _.includes(availables, language)) {
				pref = language;
				return true;
			}
			return false;
		});
		pref = pref ? pref : 'en';
		if (this.config().devMode && console) {
			console.log('preferred language ' + pref);
		}
		this.loadLocaleBundles(pref, function() {
			waitCallback(pref);
		});
	}
};
