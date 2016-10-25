module.exports = function(controllerProvider) {
	controllerProvider.controller('SplitLoadController',
	['$scope',
	'$timeout',
	'loaded',
	'drLoadingService',
	'$templateCache',
	controller]);
};

function controller($scope, $timeout, loaded, drLoadingService, $templateCache) {
	var loaderVM = this;
	$templateCache.put('splitView', loaded.view);
	loaderVM.message = loaded.view;
	drLoadingService.setLoading('main', false);
}
