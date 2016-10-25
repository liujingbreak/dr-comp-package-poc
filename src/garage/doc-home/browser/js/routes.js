
module.exports = function($routeProvider) {
	$routeProvider.when('/', {
		template: require('../views/screens.html'),
		controller: 'IntroController',
		controllerAs: 'introVm'
	});
	$routeProvider.when('/doc/:docPath*', {
		template: require('../views/doc.html'),
		controller: 'DocController',
		controllerAs: 'docVm'
	});
	$routeProvider.when('/components', {
		template: '<h1>Component Store</h1><div ng-include="\'splitView\'"></ng-include>',
		controller: 'SplitLoadController',
		controllerAs: 'loaderVM',
		resolve: {
			loaded: ['$q', '$timeout', 'drLoadingService', loadComponentsStoreModule]
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
