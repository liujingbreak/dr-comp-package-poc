var log = require('@dr/logger').getLogger('example.exampleBrowserify');
var angular = require('@dr/angularjs');
var Q = require('q');

var sampleHtml = require('./views/sample.html');

log.debug(sampleHtml);

angular.element(document.getElementById('message')).html(sampleHtml);
