module.exports = BrowserApi;

var packageNameReg = /(?:@([^\/]+)\/)?(\S+)/;

function BrowserApi(packageName) {
	if (!(this instanceof BrowserApi)) {
		return new BrowserApi(packageName);
	}
	this.packageName = packageName;
	var m = packageNameReg.exec(packageName);
	this.packageShortName = m[2];

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

	assetsUrl: function(path) {
		return this.packageShortName + '/' + path;
	}
};
