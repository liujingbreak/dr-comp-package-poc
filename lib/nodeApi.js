var EventEmitter = require('events');
var config = require('./config');

module.exports = NodeApi;

function NodeApi(name, packageInstance) {
	this.packageName = name;
	this.packageInstance = packageInstance;
}

NodeApi.prototype = {
	eventBus: new EventEmitter(),
	config: config
};
