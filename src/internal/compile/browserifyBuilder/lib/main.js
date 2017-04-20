exports.compile = function() {
	return require('./builder').compile();
};

exports.activate = function(api) {
	var chalk = require('chalk');
	var log = require('log4js').getLogger(api.packageName);
	var lr = require('tiny-lr');
	if (api.config.get('devMode') === true && api.config.get('livereload.enabled', true)) {
		try {
			var lrPort = api.config.get('livereload.port');
			lr().listen(lrPort, () => {
				log.info(chalk.red('Yo~ Live reload(tiny-lr) server is running on port %d'), lrPort);
			});
		} catch (e) {
			log.error(e);
			log.error(chalk.red('If error is caused by conflict port number, change config.yaml set `livereload.port` to a new value.'));
		}
	}
};

exports.addTransform = function() {
	require('./builder').addTransform.apply(null, arguments);
};
