var log = require('@dr/logger').getLogger('example.exampleBrowserify');

var sampleHtml = require('./sample.html');
log.debug(sampleHtml);
module.exports = sampleHtml;
