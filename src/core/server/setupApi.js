var express = require('express');
var log = require('log4js').getLogger('core.server.setApi');
var _ = require('lodash');
var Path = require('path');

module.exports = function setupApi(apiInstance, app) {
	var api = apiInstance._constructor.prototype;
	api.app = app;

	api.router = function() {
		if (this._router) {
			return this._router;
		}
		this._router = express.Router();
		var contextPath = api.config().nodeRoutePath + '/' + this.packageName;
		app.use(contextPath, this._router);
		log.debug('setup router for ' + contextPath);
		return this._router;
	};

	api.templateFolder = function(folder) {
		if (!Path.isAbsolute(folder)) {
			folder = Path.join(this.packageInstance.path, folder);
			log.debug('add view folder: ' + folder);
		}
		var views = app.get('views');
		if (_.includes(views, folder)) {
			return;
		}
		views.push(folder);
		app.set('views', views);
	};
};

var httpMethods = ['get', 'post', 'put', 'delete', 'head', 'checkout', 'mkcol',
 	'purge', 'connect', 'move', 'copy', 'm-search', 'report', 'notify', 'search',
	'options', 'subscribe', 'patch', 'trace', 'lock', 'unlock', 'merge', 'propfind',
	'unsubscribe', 'mkactivity', 'proppatch', 'all'];

function delegateRouter(router) {
	router;
}
