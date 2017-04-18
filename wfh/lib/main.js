//require('./nodeSearchPath');
require('../bin/nodePath')();
var argv = require('yargs')
	.describe('root', 'workspace folder')
	.default('root', process.env.DR_ROOT_DIR || process.cwd())
	.describe('p', '<entry-package-name>')
	.alias('p', 'package')
	.describe('l', '<locale> for specific locale, e.g. "en", "zh", which are configured in config.yaml')
	.alias('l', 'locale')
	.describe('webpack-watch', 'Run Webpack in watch mode')
	.alias('webpack-watch', 'ww')
	.global(['root', 'ww', 'p', 'l'])
	.argv;

//require('./gulp/cli')(argv.root).init();
var config = require('./config');
//config.reload();

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
