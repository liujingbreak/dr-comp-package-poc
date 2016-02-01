var express = require('express');
var log = require('log4js').getLogger('core.server.setApi');
var _ = require('lodash');
var Path = require('path');

module.exports = function setupApi(apiInstance, app) {
	var apiPrototype = apiInstance._constructor.prototype;
	apiPrototype.app = app;

	apiPrototype.router = function() {
		if (this._router) {
			return this._router;
		}
		this._router = express.Router();
		var contextPath = apiInstance.config().nodeRoutePath + '/' + this.packageName;
		var packageRelPath = Path.relative(this.config().rootPath, this.packageInstance.path);
		log.debug('package relative path: ' + packageRelPath);
		packageRelPath += '/';

		app.use(contextPath, function(req, res, next) {
			var oldRender = res.render;
			// TODO: Maybe performanc can be improved here, a brand
			// new res.render() function will be created againts every request handling
			res.render = function() {
				log.debug('in hacked res.render()');
				var args = [].slice.call(arguments);
				args[0] = packageRelPath + arguments[0];
				return oldRender.apply(this, args);
			};
			next();
		});
		app.use(contextPath, this._router);
		log.debug('setup router for ' + contextPath);
		return this._router;
	};
};
