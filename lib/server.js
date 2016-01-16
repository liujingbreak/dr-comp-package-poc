var config = require('./config');
var log = require('log4js').getLogger('server');
var http = require('http');
var app = require('./http/app');
var mafia = require('./gangsta');
var pkMgr = require('./packageMgr');
var _ = require('lodash');

var server, port;

uncaughtException();
loadPackages()
.then(function() {
	routePackages();
}).then(function() {
	startExpress();
}).then(function() {
	return mafia;
}).then(function(mafiaQuote) {
	if (mafiaQuote) {
		log.info('    " ' + mafiaQuote + ' "    ');
	}
});

function startExpress() {
	port = config().port;
	server = http.createServer(app);
	server.listen(port);
	server.on('error', onError);
	server.on('listening', onListening);
}

function loadPackages() {
	return pkMgr.loadInternalPackages()
	.then(pkMgr.loadExternalPackages);
}

function uncaughtException() {
	process.removeAllListeners('uncaughtException');
	process.on('uncaughtException', function(err) {
		// handle the error safely
		log.error('Uncaught exception: ', err, err.stack);
	});
}

function routePackages() {
	_.forOwn(pkMgr.packages, function(value, key) {
		log.debug(key);
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
}
