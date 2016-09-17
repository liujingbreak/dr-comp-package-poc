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
		$timeout(function() {
			drLoadingService.setLoading('main', false);
		}, 0);
	}
}

MainController.$inject = ['$scope', '$timeout', 'drLoadingService'];
