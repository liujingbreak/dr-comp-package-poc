var EventEmitter = require('events');
var config = require('./config');

module.exports = NodeApi;

function NodeApi(name, expressApp) {
	this.packageName = name;
	this.expressApp = expressApp;
}

NodeApi.prototype = {
	eventBus: new EventEmitter(),
	config: config
};
