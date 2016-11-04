var mainModule;
module.exports = function(controllerProvider) {
	mainModule = controllerProvider;
	mainModule.controller('SplitLoadController',
	['$scope',
	'$timeout',
	'loaded',
	'drLoadingService',
	'$templateCache',
	controller]);
};

function controller($scope, $timeout, loaded, drLoadingService, $templateCache) {
	$scope.mainVm.selectedMenuIdx = 2;
	$templateCache.put('splitView', loaded.view);
	if (!loaded.created) {
		loaded.created = true;
		loaded.createModule(mainModule);
	}
	drLoadingService.setLoading('main', false);
}
