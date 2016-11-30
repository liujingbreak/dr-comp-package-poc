exports.compile = function() {
	require('./builder').compile();
};

exports.activate = function(api) {
	var chalk = require('chalk');
	var log = require('log4js').getLogger(api.packageName);
	var livereload = require('livereload');
	if (api.config.get('devMode') === true) {
		log.info(chalk.red('Yo~ livereload server is running on port %d, run `gulp watch` to speed up your coding job !!'), api.config.get('livereload.port'));
		var server = livereload.createServer(api.config.get('livereload'));
		server.watch(api.config.resolve('staticDir'));
	}
};

exports.addTransform = function() {
	require('./builder').addTransform.apply(null, arguments);
};
