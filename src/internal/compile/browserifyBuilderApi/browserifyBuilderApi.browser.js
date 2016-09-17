var resolveUrl = require('./resolveUrl');
var _ = require('lodash');
module.exports = BrowserApi;

var packageNameReg = /(?:@([^\/]+)\/)?(\S+)/;

window.$translate = function(text) {
	return text;
};

function BrowserApi(packageName, bundleName) {
	if (!(this instanceof BrowserApi)) {
		return new BrowserApi(packageName);
	}
	this.packageName = packageName;
	var m = packageNameReg.exec(packageName);
	this.packageShortName = m[2];
	this.bundle = bundleName;

	var path = this.config.get(['packageContextPathMapping', this.packageShortName]);
	path = path != null ? path : '/' + this.packageShortName;
	this.contextPath = this.config().serverURL + path;
}

BrowserApi.setup = function(obj) {
	_.assign(BrowserApi.prototype, obj);
};

/**
 * Code splitting
 * @param  {string | string[]} bundlePaths  dependencies bundles
 * @param  {function(function require())} callBack
 */
BrowserApi.ensureRequire = function(splitPoints, callBack) {
	var self = BrowserApi.prototype;
	console.log('BrowserApi.ensureRequire()');
	var loadedBundleFileSet = self.loadedBundleFileSet;

	var js = {}; // JS bundles need to be loaded
	var css = {}; // CSS bundles need to be loaded
	var allLoaded = true;
	_.each(splitPoints, function(splitPoint) {
		var jsBundles = self.splitPoints[splitPoint].js;
		var cssBundles = self.splitPoints[splitPoint].css;
		_.each(jsBundles, function(jsBundle) {
			if (!_.has(loadedBundleFileSet, jsBundle)) {
				allLoaded = false;
				js[jsBundle] = 1;
			}
		});
		_.each(cssBundles, function(cssBundle) {
			if (!_.has(loadedBundleFileSet, cssBundle)) {
				allLoaded = false;
				css[cssBundle] = 1;
			}
		});
		var localedBundles = self.splitPoints[splitPoint];
		if (localedBundles) {
			_.each(localedBundles.locales[self.lastLoadedLocale].js, function(bundle) {
				if (!_.has(loadedBundleFileSet, bundle)) {
					allLoaded = false;
					js[bundle] = 1;
				}
			});
			_.each(localedBundles.locales[self.lastLoadedLocale].css, function(bundle) {
				if (!_.has(loadedBundleFileSet, bundle)) {
					allLoaded = false;
					css[bundle] = 1;
				}
			});
		}
	});
	if (allLoaded) {
		callBack(require);
		return;
	}
	js = _.keys(js);
	css = _.keys(css);
	if (self.isDebug()) {
		console.log('loading ' + css);
	}
	// load CSS
	if (_.size(css) > 0) {
		self._loadCssBundles(css);
	}
	if (self.isDebug()) {
		console.log('loading ' + js);
	}
	// load JS
	window.$LAB.script(_.map(js, function(jsPath) {
		var prefix = (jsPath.charAt(0) === '/' || jsPath.length >= 7 && (jsPath.substring(0, 7) === 'http://' || jsPath.substring(0, 8) === 'https://')) ? '' : self.config().staticAssetsURL;
		return prefix + '/' + jsPath;
	})).wait(function() {
		self.markBundleLoaded(js);
		self.markBundleLoaded(css);
		callBack(require);
	});
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

	loadLocaleBundles: function(locale, waitCallback) {
		var self = this;
		var prefix = this.config().staticAssetsURL;
		var localeBundles = this.localeBundlesMap[locale];
		var localeBundleJsUrls = _.map(localeBundles.js, function(bundle) {
			return prefix + '/' + bundle;
		});
		if (localeBundles.css && localeBundles.css.length > 0) {
			this._loadCssBundles(localeBundles.css);
		}
		BrowserApi.prototype.lastLoadedLocale = locale;
		window.$LAB.script(localeBundleJsUrls).wait(function() {
			BrowserApi.prototype.i18nLoaded = true;
			self.markBundleLoaded(localeBundles.js);
			self.markBundleLoaded(localeBundles.css);
			waitCallback();
		});
	},

	_loadCssBundles: function(paths) {
		var prefix = this.config().staticAssetsURL;
		var h = window.document.getElementsByTagName('head')[0];
		_.each(paths, function(bundle) {
			var cssDom = document.createElement('link');
			cssDom.rel = 'stylesheet';
			cssDom.href = prefix + '/' + bundle;
			cssDom.type = 'text/css';
			cssDom.id = bundle;
			h.appendChild(cssDom);
		});
	},

	loadPrefLocaleBundles: function(waitCallback) {
		var pref = this.getPrefLanguage();
		if (this.config().devMode && console) {
			console.log('preferred language ' + pref);
		}
		this.loadLocaleBundles(pref, function() {
			waitCallback(pref);
		});
	},

	isLocaleBundleLoaded: function() {
		return this.i18nLoaded;
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
	}
};

BrowserApi.prototype.config.set = function(path, value) {
	_.set(BrowserApi.prototype._config, path, value);
	return BrowserApi.prototype._config;
};

BrowserApi.prototype.config.get = function(propPath, defaultValue) {
	return _.get(BrowserApi.prototype._config, propPath, defaultValue);
};
