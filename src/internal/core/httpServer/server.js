var http = require('http');
var https = require('https');
var fs = require('fs');

var config, log;

exports.activate = function(api) {
	log = require('@dr/logger').getLogger(api.packageName);
	config = api.config;

	if (config().ssl && config().ssl.enabled) {
		if (!config().ssl.key) {
			config().ssl.key = 'key.pem';
		}
		if (!config().ssl.cert) {
			config().ssl.cert = 'cert.pem';
		}
		if (!fileAccessable(config.resolve('ssl.key'))) {
			log.error('There is no file available referenced by config.yaml property "ssl"."key" ' + config().ssl.key);
			return;
		}
		if (!fileAccessable(config.resolve('ssl.cert'))) {
			log.error('There is no file available referenced by config.yaml property "ssl"."cert" ' + config().ssl.cert);
			return;
		}
		log.debug('SSL enabled');
		api.eventBus.on('expressAppCreated', startHttpsServer);
	} else {
		api.eventBus.on('expressAppCreated', startHttpServer);
	}

	function startHttpServer(app) {
		log.info('start HTTP');
		var port = config().port ? config().port : 80;
		var server = http.createServer(app);
		server.listen(port);
		server.on('error', () => {
			onError(server, port);
		});
		server.on('listening', () => { onListening(server); });
	}

	function startHttpsServer(app) {
		log.info('start HTTPS');
		var port = config().ssl.port ? config().ssl.port : 433;
		var server = https.createServer({
			key: fs.readFileSync(config.resolve('ssl.key')),
			cert: fs.readFileSync(config.resolve('ssl.cert'))
		}, app);
		server.listen(port);
		server.on('error', () => {
			onError(server, port);
		});
		server.on('listening', () => { onListening(server); });

		var redirectHttpServer = http.createServer((req, res) => {
			var url = 'https://' + /([^:]*)(:.*)?/.exec(req.headers.host)[1] + ':' + port;
			log.debug('redirect to ' + url);
			res.writeHead(307, {
				Location: url,
				'Content-Type': 'text/plain'
			});
			res.end('');
		});
		redirectHttpServer.listen(config().port ? config().port : 80);
		redirectHttpServer.on('listening', () => { onListening(redirectHttpServer); });
	}

	/**
	 * Event listener for HTTP server "listening" event.
	 */
	function onListening(server) {
		var addr = server.address();
		var bind = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + addr.port;
		log.info('Listening on ' + bind);
		api.eventBus.emit('serverStarted', {});
	}

	/**
	 * Event listener for HTTP server "error" event.
	 */
	function onError(error, port) {
		if (error.syscall !== 'listen') {
			throw error;
		}

		var bind = typeof port === 'string' ? 'Pipe ' + port : 'Port ' + port;

		// handle specific listen errors with friendly messages
		switch (error.code) {
			case 'EACCES':
				log.error(bind + ' requires elevated privileges');
				process.exit(1);
				break;
			case 'EADDRINUSE':
				log.error(bind + ' is already in use');
				process.exit(1);
				break;
			default:
				throw error;
		}
	}
};

function fileAccessable(file) {
	try {
		fs.accessSync(file, fs.R_OK);
		return true;
	} catch (e) {
		return false;
	}
}
