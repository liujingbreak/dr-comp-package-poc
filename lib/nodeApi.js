var EventEmitter = require('events');
var config = require('./config');
var _ = require('lodash');
var express = require('express');
var log = require('log4js').getLogger('nodeApi');

module.exports = NodeApi;

function NodeApi(name, expressApp) {
	this.packageName = name;
	this.expressApp = expressApp;
}

NodeApi.prototype = {
	router: function() {
		if (this._router) {
			return this._router;
		}
		this._router = express.Router();
		//path = path ? (_.startsWith(path, '/') ? path : '/' + path) : '';
		var contextPath = config().nodeRoutePath + '/' +
			this.packageName;
		this.expressApp.use(contextPath, this._router);

		log.debug('setup router for ' + contextPath);
		return this._router;
	},

	templateFolder: function(absFolderPath) {
		var views = this.expressApp.get('views');
		if (_.includes(views, absFolderPath)) {
			return;
		}
		views.push(absFolderPath);
		this.expressApp.set('views', views);
	},

	eventBus: new EventEmitter(),
	config: config
};
