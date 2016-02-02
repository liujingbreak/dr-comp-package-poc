var express = require('express');
var path = require('path');
//var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var engines = require('consolidate');
var swig = require('swig');
var setupApi = require('./setupApi');
var log = require('log4js').getLogger('server.app');

module.exports = {
	activate: function(api) {
		var app = express();
		setupApi(api);
		api.eventBus.on('packagesActivated', function() {
			create(app, api.config());
			api.eventBus.emit('expressStarted', app);
		});
	}
};

function create(app, setting) {
	// view engine setup
	swig.setDefaults({
		varControls: ['{=', '=}']
	});
	app.engine('html', engines.swig);
	app.engine('jade', engines.jade);
	//TODO should be a list fetched from packages
	app.set('views', [path.join(__dirname, 'views'), setting.rootPath]);
	app.set('view engine', 'html');

	// uncomment after placing your favicon in /public
	//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
	app.use(logger('dev'));
	app.use(bodyParser.json());
	app.use(bodyParser.urlencoded({
		extended: false
	}));
	app.use(cookieParser());

	setupApi.createPackageDefinedMiddleware(app);
	setupApi.createPackageDefinedRouters(app);

	var assetsFolder = path.join(setting.rootPath, setting.destDir);
	log.debug('express static path: ' + assetsFolder);
	app.use('/', express.static(assetsFolder));

	// error handlers
	// catch 404 and forward to error handler
	app.use(function(req, res, next) {
		var err = new Error('Not Found');
		err.status = 404;
		next(err);
	});
	// development error handler
	// will print stacktrace
	if (app.get('env') === 'development') {
		app.use(function(err, req, res, next) {
			res.status(err.status || 500);
			res.render('error.jade', {
				message: err.message,
				error: err
			});
		});
	}

	// production error handler
	// no stacktraces leaked to user
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.render('error.jade', {
			message: err.message,
			error: {}
		});
	});
	return app;
}
