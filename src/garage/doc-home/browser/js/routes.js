
module.exports = function($stateProvider, $urlRouterProvider) {
	$urlRouterProvider.when('', '/');
	$stateProvider.state('home', {
		url: '/',
		views: {
			main: {
				template: require('../views/screens.html'),
				controller: 'IntroController',
				controllerAs: 'introVm'
			}
		}
	});
	$stateProvider.state('doc', {
		url: '/doc/:docPath',
		views: {
			main: {
				template: require('../views/doc.html'),
				controller: 'DocController',
				controllerAs: 'docVm'
			}
		}
	});
	$stateProvider.state('comp', {
		url: '/components',
		views: {
			main: {
				template: '<div ng-include="\'splitView\'"></ng-include>',
				controller: 'SplitLoadController',
				controllerAs: 'loaderVM',
				resolve: {
					loaded: ['$q', '$timeout', 'drLoadingService', loadComponentsStoreModule]
				}
			}
		}
	});
};

function loadComponentsStoreModule($q, $timeout, drLoadingService) {
	var defer = $q.defer();
	require.ensure(['@dr/comp-store'], function(require) {
		//$timeout(function() {
		defer.resolve(require('@dr/comp-store'));
		//}, 5000);
	});
	return defer.promise;
}
