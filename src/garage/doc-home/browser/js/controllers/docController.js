module.exports = function(controllerProvider) {
	controllerProvider.controller('DocController',
	['$scope',
	'$timeout',
	'$routeParams',
	controller]);
};

function controller($scope, $timeout, $routeParams) {
	var docVm = this;
	$scope.mainVm.selectedMenuIdx = 1;
	docVm.docAddress = __api.assetsUrl('readmes', 'cn/' + $routeParams.name + '.html');
	$scope.mainVm.loaded = true;
}
