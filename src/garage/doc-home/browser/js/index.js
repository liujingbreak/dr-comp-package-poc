require('@dr/angularjs');
require('@dr/doc-ui');
require('@dr/markdown-viewer');
require('@dr/respond-js');

var textAnim = require('@dr/text-anim-ng');


var docHome = angular.module('docHome', ['ngAnimate', 'ngRoute', 'docUi']);
module.exports = docHome;

docHome.config(['$routeProvider', '$controllerProvider', '$compileProvider', '$filterProvider', '$provide',
	function($routeProvider, $controllerProvider, $compileProvider, $filterProvider, $provide) {
		// cache these providers so that we can lazy load angular component later on
		// see http://ify.io/lazy-loading-in-angularjs/
		docHome.controllerProvider = $controllerProvider;
		docHome.compileProvider    = $compileProvider;
		docHome.routeProvider      = $routeProvider;
		docHome.filterProvider     = $filterProvider;
		docHome.provide            = $provide;
		textAnim.register(docHome.compileProvider);
		require('./routes')($routeProvider);
	}]);
docHome
.run(['$templateCache', function($templateCache) {
		$templateCache.put('screens.html', require('../views/screens.html'));
	}]);
require('./controllers/mainController')(docHome);
require('./controllers/introController')(docHome);
require('./controllers/asideController')(docHome);
require('./controllers/docController')(docHome);
require('./directives/animate')(docHome);
require('./directives/menuAside')(docHome);
require('./directives/docHome')(docHome);
require('./directives/showOnReady')(docHome);
require('./service/scrollableAnim')(docHome);

angular.element(document).ready(function() {
	angular.bootstrap(document, ['docHome']);
});
