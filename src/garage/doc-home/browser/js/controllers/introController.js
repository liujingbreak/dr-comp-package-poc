module.exports = function(controllerProvider) {
	controllerProvider.controller('IntroController', introController);
};

function introController($scope, $timeout, drLoadingService) {
	var introVm = this;
	$scope.mainVm.selectedMenuIdx = 0;
	introVm.animSlogonStart = false;
	introVm.animStart = false;
	introVm.screen1Timeline = new TimelineLite({paused: true});
	introVm.screen2Timeline = new TimelineLite({paused: true});
	drLoadingService.setLoading('main', false);
	$timeout(function() {
		introVm.animStart = true;
	}, 500);
}

introController.$inject = ['$scope', '$timeout', 'drLoadingService'];
