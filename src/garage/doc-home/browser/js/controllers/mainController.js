module.exports = function(controllerProvider) {
	controllerProvider.controller('MainController', MainController);
};

function MainController($scope, $timeout, drLoadingService) {
	$scope.$on('$routeChangeStart', function() {
		drLoadingService.setLoading('main', true);
	});
	$scope.$on('$routeChangeSuccess', stopLoading);
	$scope.$on('$routeChangeError', stopLoading);

	function stopLoading() {
		drLoadingService.setLoading('main', false);
	}
}

MainController.$inject = ['$scope', '$timeout', 'drLoadingService'];
