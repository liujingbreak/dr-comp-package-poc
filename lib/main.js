require('./nodeSearchPath');
var config = require('./config');
require('./logConfig')(config().rootPath, config().log4jsReloadSeconds || 300);
var log = require('log4js').getLogger('server');
var NodeApi = require('./nodeApi');
var pkMgr = require('./packageMgr');

try {
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
		log.error('Uncaught exception: ', err, err.stack);
		throw err; // let PM2 handle exception
	});
}
