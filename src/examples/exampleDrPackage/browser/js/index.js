var common = require('@dr/example-common');
var log = require('@dr/logger').getLogger('exmaple-dr');
var $ = require('jquery');

log.info(__filename + ' is running');
log.info(' let\'s if browserify works for requiring stuff from another file: ' + require('./exportText'));
log.info(common);

$('#demoMessage').html('Hellow buddy');

module.exports = require('./exportText');
