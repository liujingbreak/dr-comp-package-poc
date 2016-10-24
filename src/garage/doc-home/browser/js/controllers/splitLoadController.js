module.exports = function(controllerProvider) {
	controllerProvider.controller('SplitLoadController',
	['$scope',
	'$timeout',
	'loaded',
	'drLoadingService',
	controller]);
};

function controller($scope, $timeout, loaded, drLoadingService) {
	var loaderVM = this;
	loaderVM.message = loaded.view;
	drLoadingService.setLoading('main', false);
}
