var util = require('util');

module.exports = {
	handleBowerLogger: handleBowerLogger
};

/**
 * handle Bower logger action or prompt event.
 * @param  {bowerLogger} logger bower logger
 */
function handleBowerLogger(logger) {
	logger.on('log', function(msg) {
		console.log('[%s] %s: %s\n\t%s', msg.level, msg.id, msg.message, util.inspect(msg.data));
	});

	logger.on('prompt', function(prompts, callback) {
		console.log('>>> ' + prompt);
		callback('y');
	});
}
