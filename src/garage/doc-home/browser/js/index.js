require('jquery');
require('@dr/angularjs');
require('angular-ui-router');
require('@dr/doc-ui');
require('@dr/markdown-viewer');
require('@dr/light-respond-js');


var textAnim = require('@dr/text-anim-ng');


var docHome = angular.module('docHome', ['ngAnimate', 'ui.router', 'docUi']);
require('@dr/translate-generator').init(docHome);
module.exports = docHome;

docHome.config(['$controllerProvider', '$compileProvider', '$filterProvider', '$provide', '$stateProvider', '$urlRouterProvider',
	function($controllerProvider, $compileProvider, $filterProvider, $provide, $stateProvider, $urlRouterProvider) {
		// cache these providers so that we can lazy load angular component later on
		// see http://ify.io/lazy-loading-in-angularjs/
		docHome.controllerProvider = $controllerProvider;
		docHome.compileProvider    = $compileProvider;
		docHome.filterProvider     = $filterProvider;
		docHome.provide            = $provide;
		docHome.$stateProvider = $stateProvider;
		docHome.$urlRouterProvider = $urlRouterProvider;
		textAnim.register(docHome.compileProvider);
		require('./routes')($stateProvider, $urlRouterProvider);
	}]);
docHome
.run(['$templateCache', 'drLoadingService', 'drTranslateService', function($templateCache, drLoadingService, drTranslateService) {
	$templateCache.put('screens.html', require('../views/screens.html'));
	drLoadingService.setLoading('main', true);
	drTranslateService.addResource(__api.packageShortName, require('@dr/doc-home/i18n'));
}]);
require('./controllers/mainController')(docHome);
require('./controllers/introController')(docHome);
require('./controllers/asideController')(docHome);
require('./controllers/docController')(docHome);
require('./controllers/splitLoadController')(docHome);
require('./directives/animate')(docHome);
require('./directives/menuAside')(docHome);
require('./directives/docHome')(docHome);
require('./directives/showOnReady')(docHome);
require('./service/scrollableAnim')(docHome);

angular.element(document).ready(function() {
	angular.bootstrap(document, ['docHome']);
});
