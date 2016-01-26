var log = require('@dr/logger').getLogger('example.exampleBrowserify');
var Q = require('q');

var sampleHtml = require('./views/sample.html');

log.debug(sampleHtml);
module.exports = sampleHtml;
