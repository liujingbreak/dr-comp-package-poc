var Emitter = require('eventemitter3');

module.exports = BrowserApi;

function BrowserApi(name) {
	if (!(this instanceof BrowserApi)) {
		return new BrowserApi(name);
	}
	this.packageName = name;
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
