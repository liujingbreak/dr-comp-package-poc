var log = require('@dr/logger').getLogger('example.exampleBrowserify');
var angular = require('@dr/angularjs');

var sampleHtml = require('./sampleBrowser.js');

log.debug(sampleHtml);

angular.element(document.getElementById('message')).html(sampleHtml);

console.log(require);
// require('ax');
