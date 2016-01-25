var EventEmitter = require('events');
var config = require('./config');

module.exports = NodeApi;

function NodeApi(name, packageInstance) {
	this.packageName = name;
	this.packageInstance = packageInstance;
	this._constructor = NodeApi;
}

NodeApi.prototype = {
	isBrowser: function() {
		return false;
	},
	isNode: function() {
		return true;
	},
	eventBus: new EventEmitter(),
	config: config
};
