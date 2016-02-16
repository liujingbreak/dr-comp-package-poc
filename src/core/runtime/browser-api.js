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
		return true;
	},

	isNode: function() {
		return false;
	},
	eventBus: new Emitter()
};
