var EventEmitter = require('events');
var config = require('./config');

module.exports = NodeApi;

function NodeApi(name, packageInstance) {
	this.packageName = name;
	this.packageInstance = packageInstance;
	this.contextPath = this._contextPath();
}

NodeApi.prototype = {
	isBrowser: function() {
		return !!process.browser;
	},

	isNode: function() {
		return !process.browser;
	},

	_contextPath: function() {
		var path = this.config().packageContextPathMapping[this.packageName];
		path = path != null ? path : '/' + this.packageName;
		if (this.config().nodeRoutePath) {
			path = this.config().nodeRoutePath + '/' + path;
		}
		return path.replace(/\/\/+/g, '/');
	},

	eventBus: new EventEmitter(),
	config: config,
	packageUtils: require('./packageMgr/packageUtils')
};
