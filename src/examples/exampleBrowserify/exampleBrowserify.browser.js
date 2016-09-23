var log = require('@dr/logger').getLogger('example.exampleBrowserify');
require('@dr/example-partial');
var angular = require('@dr/angularjs');

var sampleHtml = require('./browser');

log.debug(sampleHtml);

angular.element(document.getElementById('message')).html(sampleHtml);
angular.element(document.getElementById('assets-url')).html(__api.assetsUrl('/resource.json'));

require('@dr/gsap');

