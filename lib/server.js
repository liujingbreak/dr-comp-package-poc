var config = require('./config');
var log = require('log4js').getLogger('server');
var http = require('http');
var Path = require('path');
var NodeApi = require('./nodeApi');
var pkMgr = require('./packageMgr')(NodeApi);


var server, port;

try {
	require('log4js').configure(Path.join(config().rootPath, 'log4js.json'));
	uncaughtException();
	process._config = config;
	NodeApi.prototype.eventBus.on('expressStarted', startHttpServer);
	pkMgr.readPackages();
	pkMgr.loadCorePackages(NodeApi);
	pkMgr.loadPackages(NodeApi);
} catch (err) {
	log.error('Failed to start server', err);
	throw err;
}

function startHttpServer(app) {
	port = config().port;
	server = http.createServer(app);
	server.listen(port);
	server.on('error', onError);
	server.on('listening', onListening);
}

function uncaughtException() {
	process.removeAllListeners('uncaughtException');
	process.on('uncaughtException', function(err) {
		// handle the error safely
		log.error('Uncaught exception: ', err, err.stack);
	});
}



/**
 * Event listener for HTTP server "error" event.
 */
function onError(error) {
	if (error.syscall !== 'listen') {
		throw error;
	}

	var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

	// handle specific listen errors with friendly messages
	switch (error.code) {
		case 'EACCES':
			console.error(bind + ' requires elevated privileges');
			process.exit(1);
			break;
		case 'EADDRINUSE':
			console.error(bind + ' is already in use');
			process.exit(1);
			break;
		default:
			throw error;
	}
}

/**
 * Event listener for HTTP server "listening" event.
 */
function onListening() {
	var addr = server.address();
	var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
	log.info('Listening on ' + bind);
	NodeApi.prototype.eventBus.emit('serverStarted', {});
}
