window.jQuery = require('jquery');
require('@dr/angularjs');
require('@dr/doc-ui');

var textAnim = require('@dr/text-anim-ng');

var pocHome = angular.module('pocHome', ['ngAnimate', 'ngRoute']);
module.exports = pocHome;

pocHome.config(['$routeProvider', '$controllerProvider', '$compileProvider', '$filterProvider', '$provide',
	function($routeProvider, $controllerProvider, $compileProvider, $filterProvider, $provide) {
		// cache these providers so that we can lazy load angular component later on
		// see http://ify.io/lazy-loading-in-angularjs/
		pocHome.controllerProvider = $controllerProvider;
		pocHome.compileProvider    = $compileProvider;
		pocHome.routeProvider      = $routeProvider;
		pocHome.filterProvider     = $filterProvider;
		pocHome.provide            = $provide;
		textAnim.register(pocHome.compileProvider);
	}]);
pocHome
.run(['$templateCache', function($templateCache) {
		$templateCache.put('screens.html', require('../views/screens.html'));
	}]);

require('./controllers/mainController')(pocHome);
require('./controllers/AsideController')(pocHome);
require('./directives/animate.js')(pocHome);
require('./service/scrollableAnim')(pocHome);

angular.element(document).ready(function() {
	angular.bootstrap(document, ['pocHome']);
});
