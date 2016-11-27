module.exports = function($stateProvider) {
	$stateProvider.state('components', {
		url: '/components',
		resolve: {
			compStore: loadComponentsStoreModule
		},
		views: {
			main: {
				controller: ['$scope', 'drLoadingService', function($scope, drLoadingService) {
					$scope.mainVm.selectedMenuIdx = 2;
					drLoadingService.setLoading('main', false);
				}],
				template: '<comp-store></comp-store>'
			}
		}
	});
	$stateProvider.state('components.details', {
		url: '/:compId',
		views: {
			compMain: {
				template: '<comp-details></comp-details>'
			}
		}
	});
};

function loadComponentsStoreModule($q, $timeout) {
	var defer = $q.defer();
	require.ensure(['@dr/comp-store'], function() {
		//$timeout(function() {
		require('@dr/comp-store').init(angular.module('lazyModule'), 'components');
		defer.resolve();
		//}, 5000);
	});
	return defer.promise;
}
loadComponentsStoreModule.$inject = ['$q', '$timeout'];
