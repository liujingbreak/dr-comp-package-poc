var common = require('@dr/example-common');
var log = require('@dr/logger').getLogger('exmaple-dr');

log.info(__filename + ' is running');
log.info(' let\'s if browserify works for requiring stuff from another file: ' + require('./exportText'));
log.info(common);
module.exports = require('./exportText');
