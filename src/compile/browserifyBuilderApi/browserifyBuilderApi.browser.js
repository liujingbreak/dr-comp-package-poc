var Emitter = require('eventemitter3');

module.exports = BrowserApi;

function BrowserApi(packageName) {
	if (!(this instanceof BrowserApi)) {
		return new BrowserApi(packageName);
	}
	this.packageName = packageName;
	// this.packageInstance = attrs.packageInstance;
	// this.contextPath = attrs.contextPath;
}

BrowserApi.prototype = {
	isBrowser: function() {
		return !!process.browser;
	},

	isNode: function() {
		return !process.browser;
	},
	eventBus: new Emitter()
};
