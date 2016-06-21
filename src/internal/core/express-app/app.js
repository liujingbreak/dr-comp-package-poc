var express = require('express');
var path = require('path');
//var favicon = require('serve-favicon');
//var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var engines = require('consolidate');
var swig = require('swig');
var setupApi = require('./setupApi');
var log4js = require('log4js');
var api = require('__api');
var log = log4js.getLogger(api.packageName);
var compression = require('compression');

module.exports = {
	activate: function() {
		var app = express();
		setupApi(api);
		api.eventBus.on('packagesActivated', function(packageCache) {
			process.nextTick(()=> {
				create(app, api.config(), packageCache);
				api.eventBus.emit('appCreated', app);
			});
		});
	}
};

function create(app, setting, packageCache) {
	// view engine setup
	swig.setDefaults({
		varControls: ['{=', '=}']
	});
	app.engine('html', engines.swig);
	app.engine('jade', engines.jade);

	app.set('views', [path.join(__dirname, 'views'), setting.rootPath]);
	app.set('view engine', 'html');
	app.set('env', api.config().devMode ? 'development' : 'production' );

	// uncomment after placing your favicon in /public
	//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
	//app.use(logger('dev'));
	app.use(log4js.connectLogger(log, {level: log4js.levels.INFO}));
	app.use(bodyParser.json({
		limit: '50mb'
	}));
	app.use(bodyParser.urlencoded({
		extended: false
	}));
	app.use(cookieParser());
	app.use(compression());
	setupApi.createPackageDefinedMiddleware(app);
	setupApi.createPackageDefinedRouters(app);

	var staticFolder = path.resolve(setting.rootPath, setting.staticDir);
	log.debug('express static path: ' + staticFolder);
	app.use('/', express.static(staticFolder, {
		maxAge: setting.cacheControlMaxAge,
		setHeaders: setCORSHeader
	}));
	app.get('/', function(req, res) {
		res.render('index.html', {});
	});

	// error handlers
	// catch 404 and forward to error handler
	app.use(function(req, res, next) {
		log.info('originalUrl: ' + req.originalUrl);
		var err = new Error('Not Found');
		err.status = 404;
		next(err);
	});
	// development error handler
	// will print stacktrace
	if (setting.devMode || app.get('env') === 'development') {
		app.use(function(err, req, res, next) {
			res.status(err.status || 500);
			log.error(err);
			res.render('error.html', {
				message: err.message,
				error: err
			});
		});
	}

	// production error handler
	// no stacktraces leaked to user
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		log.error(err);
		res.render('error.html', {
			message: err.message,
			error: {}
		});
	});
	return app;
}

function setCORSHeader(res) {
	res.setHeader('Access-Control-Allow-Origin', '*');
}
