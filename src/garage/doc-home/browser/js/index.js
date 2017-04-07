require('jquery');
require('@dr/angularjs');
require('angular-ui-router');
require('@dr/doc-ui');
require('@dr/markdown-viewer');
require('@dr/light-respond-js');
//require('angular-nicescroll/angular-nicescroll');
var lazy = require('@dr/angular-lazy');



var docHome = angular.module('docHome', ['ngAnimate', 'ngSanitize', 'ui.router', 'docUi']);

module.exports = docHome;

docHome.config(['$controllerProvider', '$compileProvider', '$filterProvider', '$provide', '$stateProvider', '$urlRouterProvider',
	function($controllerProvider, $compileProvider, $filterProvider, $provide, $stateProvider, $urlRouterProvider) {
		// cache these providers so that we can lazy load angular component later on
		// see http://ify.io/lazy-loading-in-angularjs/
		docHome.$controllerProvider = $controllerProvider;
		docHome.$compileProvider    = $compileProvider;
		docHome.$filterProvider     = $filterProvider;
		docHome.$provide            = $provide;
		docHome.$stateProvider = $stateProvider;
		docHome.$urlRouterProvider = $urlRouterProvider;
		require('./routes')($stateProvider, $urlRouterProvider);
	}]);
docHome.config(lazy.cacheInternals)
.run(function() {
	var attachFastClick = require('fastclick');
	attachFastClick(document.body);
});
require('./controllers/mainController')(docHome);
require('./controllers/introController')(docHome);
require('./controllers/asideController')(docHome);
require('./controllers/docController')(docHome);
require('./directives/animate')(docHome);
require('./directives/menuAside')(docHome);
require('./directives/docHome')(docHome);
require('./directives/showOnReady')(docHome);
require('./service/scrollableAnim')(docHome);
require('@dr/dr-ng-widgets').init(docHome);
angular.element(document).ready(function() {
	angular.bootstrap(document, ['docHome']);
});
lazy.makeLazyAngular();
angular.module('lazyModule', []);
