module.exports = function(controllerProvider) {
	controllerProvider.controller('SplitLoadController',
	['$scope',
	'$timeout',
	'loaded',
	controller]);
};

function controller($scope, $timeout, loaded) {
	var loaderVM = this;
	loaderVM.message = loaded;
}
