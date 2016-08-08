require('./nodeSearchPath');
var config = require('./config');
require('./logConfig')(config().rootPath, config().log4jsReloadSeconds);
var log = require('log4js').getLogger('lib.main');
var NodeApi = require('./nodeApi');
var pkMgr = require('./packageMgr');

try {
	uncaughtException();
	process._config = config;

	pkMgr.readPackages();
	pkMgr.loadCorePackages(NodeApi)
	.then(() => {
		return pkMgr.loadPackages(NodeApi);
	})
	.catch(err => {
		log.error('Failed to start server:', err);
		process.exit(1); // Log4js "log4jsReloadSeconds" will hang process event loop, so we have to explicitly quit.
	});
} catch (err) {
	log.error('Failed to start server:', err);
	throw err;
}

function uncaughtException() {
	//process.removeAllListeners('uncaughtException');
	process.on('uncaughtException', function(err) {
		log.error('Uncaught exception: ', err, err.stack);
		throw err; // let PM2 handle exception
	});
}
