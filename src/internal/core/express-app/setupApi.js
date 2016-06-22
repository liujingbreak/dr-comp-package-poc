var express = require('express');
var log = require('log4js').getLogger('express-app.setApi');
var _ = require('lodash');
var Path = require('path');
var swig = require('swig');

var routerSetupFuncs = [];
var middlewares = [];
var appSets = [];

module.exports = setupApi;

module.exports.createPackageDefinedMiddleware = function(app) {
	middlewares.forEach(function(func) {
		try {
			func(app);
		} catch (er) {
			log.error('package ' + func.packageName + ' middleware, original stack: ' + func.stack, er);
			throw er;
		}
	});
};

module.exports.createPackageDefinedRouters = function(app) {
	routerSetupFuncs.forEach(function(routerDef) {
		try {
			routerDef(app);
		} catch (er) {
			log.error('package ' + routerDef.packageName + ' router, original stack: ' + routerDef.stack, er);
			throw er;
		}
	});
	app.use(revertRenderFunction);
	app.use(revertRenderFunctionForError);//important
};

module.exports.applyPackageDefinedAppSetting = function(app) {
	appSets.forEach(callback => {
		callback(app, express);
	});
};

function setupApi(api, app) {
	var apiPrototype = Object.getPrototypeOf(api);
	apiPrototype.express = express;
	apiPrototype.swig = swig;
	/**
	 * setup a router under package context path
	 * same as app.use('/<package-path>', router);
	 * @return {[type]} [description]
	 */
	apiPrototype.router = function() {
		var self = this;
		if (self._router) {
			return self._router;
		}
		var router = self._router = express.Router();
		var contextPath = self.contextPath;
		var packageRelPath = Path.relative(self.config().rootPath, self.packageInstance.path);
		log.debug('package relative path: ' + packageRelPath);
		packageRelPath += '/';

		function setupRouter(app) {
			app.use(contextPath, function(req, res, next) {
				log.debug('in package level middleware, res.render will be hijacked');
				var oldRender = res.__origRender ? res.__origRender : res.render;
				res.__origRender = oldRender;
				// TODO: Maybe performanc can be improved here, a brand
				// new res.render() function will be created againts every request handling
				res.render = function() {
					// log.debug('in hacked res.render()');
					var args = [].slice.call(arguments);
					if (_.startsWith(args[0], '/')) {
						args[0] = args[0].substring(1);
					} else {
						args[0] = packageRelPath + arguments[0];
					}
					return oldRender.apply(res, args);
				};
				next();
			});
			// log.debug(self.packageName + ': app.use context path = ' + contextPath);
			app.use(contextPath, router);
		}
		setupRouter.packageName = self.packageName;
		// this function will be
		// cached in array and executed later, the current stack information
		// won't be shown if there is error in later execution progress.
		// Thus save current stack for later debug.
		setupRouter.stack = new Error().stack;
		routerSetupFuncs.push(setupRouter);
		return router;
	};

	/**
	 * set an express middleware
	 * same as calling `app.use('/optional-path', middleware)`
	 * Middleware is always registered before routers getting registered, so each
	 * request will pass through middleware prior to routers.
	 */
	['use',
	/**
	 * same as calling `app.param('/optional-path', middleware)`
	 */
	'param'].forEach(function(method) {
		apiPrototype[method] = function(x) {
			var args = [].slice.apply(arguments);
			function setupMiddleware(app) {
				app[method].apply(app, args);
			}
			setupMiddleware.packageName = this.packageName;
			// this function will be
			// cached in array and executed later, the current stack information
			// won't be shown if there is error in later execution progress.
			// Thus save current stack for later debug.
			setupMiddleware.stack = new Error().stack;
			middlewares.push(setupMiddleware);
		};
	});

	/**
	 * Callback functions will be called after express app being created
	 * @param  {Function} callback function(app, express)
	 * e.g.
	 * 	api.expressAppSet((app, express) => {
 	 * 		app.set('trust proxy', true);
 	 * 		app.set('views', Path.resolve(api.config().rootPath, '../web/views/'));
 	 * 	});
	 */
	apiPrototype.expressAppSet = (callback) => appSets.push(callback);
}

function revertRenderFunction(req, res, next) {
	log.trace('release hijacked res.render()');
	if (res.__origRender) {
		res.render = res.__origRender;
		delete res.__origRender;
	}
	next();
}

function revertRenderFunctionForError(err, req, res, next) {
	log.trace('encounter error, release hijacked res.render()');
	if (res.__origRender) {
		res.render = res.__origRender;
		delete res.__origRender;
	}
	next(err);
}
