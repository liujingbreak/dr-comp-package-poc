var express = require('express');
var path = require('path');
//var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var engines = require('consolidate');
var swig = require('swig');
var ms = require('ms');
var setupApi = require('./setupApi');
var log = require('log4js').getLogger('server.app');
var _ = require('lodash');
var fs = require('fs');
var Path = require('path');

module.exports = {
	activate: function(api, apiPrototype) {
		var app = express();
		setupApi(api, apiPrototype);
		api.eventBus.on('packagesActivated', function(packageCache) {
			create(app, api.config(), packageCache);
			api.eventBus.emit('expressStarted', app);
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

	var assetsFolder = path.resolve(setting.rootPath, setting.destDir, 'static');
	log.debug('express static path: ' + assetsFolder);
	app.use('/', express.static(assetsFolder, {
		maxAge: ms(setting.cacheControlMaxAge),
		setHeaders: setCORSHeader
	}));
	app.get('/', function(req, res) {
		res.render('index.html', {});
	});

	// package level assets folder router
	_.forOwn(packageCache, function(packageInstance, name) {
		var assetsDir = Path.resolve(setting.rootPath, packageInstance.path, 'assets');
		if (fs.existsSync(assetsDir)) {
			log.debug('/assets/' + name + ' -> ' + assetsDir);
			app.use('/assets/' + name, express.static(assetsDir, {
				maxAge: ms(setting.cacheControlMaxAge),
				setHeaders: setCORSHeader
			}));
		}
	});

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
		res.render('error.jade', {
			message: err.message,
			error: {}
		});
	});
	return app;
}

function setCORSHeader(res) {
	res.setHeader('Access-Control-Allow-Origin', '*');
}
