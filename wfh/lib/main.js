//require('./nodeSearchPath');
require('../bin/nodePath')();
var argv = require('yargs')
	.describe('p', '<entry-package-name>')
	.alias('p', 'package').argv;

var config = require('./config');
require('./logConfig')(config().rootPath, config().log4jsReloadSeconds);
var log = require('log4js').getLogger('lib.main');
var pkMgr = require('./packageMgr');

try {
	uncaughtException();
	process._config = config;

	pkMgr.runServer(argv)
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
