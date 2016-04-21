require('./nodeSearchPath');
var config = require('./config');
var log = require('log4js').getLogger('server');
var Path = require('path');
var NodeApi = require('./nodeApi');
var pkMgr = require('./packageMgr');

try {
	require('log4js').configure(Path.join(config().rootPath, 'log4js.json'));
	uncaughtException();
	process._config = config;

	pkMgr.readPackages();
	pkMgr.loadCorePackages(NodeApi)
	.then(() => {
		pkMgr.loadPackages(NodeApi);
	});
} catch (err) {
	log.error('Failed to start server', err);
	throw err;
}

function uncaughtException() {
	process.removeAllListeners('uncaughtException');
	process.on('uncaughtException', function(err) {
		// handle the error safely
		log.error('Uncaught exception: ', err, err.stack);
	});
}
