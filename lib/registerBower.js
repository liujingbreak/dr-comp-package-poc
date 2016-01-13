var bower = require('../../bower');

var logger = bower.commands.register('dr-sample-bower-package', './sampleBowerPackage');
console.log(logger);
require('./bower-utils').handleBowerLogger(logger);

logger.on('log', function(msg) {
	console.log(msg);
});

logger.on('prompt', function(prompts, callback) {
	console.log('>>> ' + prompt);
	callback('y');
});
