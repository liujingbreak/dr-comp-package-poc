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

BrowserApi.prototype = {
	config: function() {
		return BrowserApi._config;
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
		} else {
			packageName = packageNameReg.exec(packageName)[2];
		}
		if (_.startsWith(path, '/')) {
			path = path.substring(1);
		}
		var staticAssetsURL = this.config().staticAssetsURL;
		if (_.endsWith(staticAssetsURL, '/')) {
			staticAssetsURL = staticAssetsURL.substring(0, staticAssetsURL.length - 1);
		}
		return staticAssetsURL + '/' + packageName + '/' + path;
	}
};
