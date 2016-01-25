var quote = require('./exportText');
var common = require('@dr/example-common');
var logger = require('@dr/logger').getLogger('exmaple-dr');

logger.info('greeting from package browser-side code');
logger.info(' let\'s if browserify works for requiring stuff from another file: ' + quote);
logger.info(common);
module.exports = quote;
