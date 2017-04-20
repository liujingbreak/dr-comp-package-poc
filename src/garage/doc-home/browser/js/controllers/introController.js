module.exports = function(controllerProvider) {
	controllerProvider.controller('IntroController', introController);
};

function introController($scope, $timeout, drLoadingService) {
	var introVm = this;
	$scope.mainVm.selectedMenuIdx = 0;
	introVm.animSlogonStart = false;
	introVm.animStart = false;
	introVm.screen1Timeline = new TimelineLite({
		paused: true
	});
	introVm.screen2Timeline = new TimelineLite({
		paused: true
	});
	drLoadingService.setLoading('main', false);
	$timeout(function() {
		introVm.animStart = true;
	}, 500);


	$scope.devStep = 0;
	initDevStatus();
	$scope.devGo = function(devStep) {
		$scope.devStep += 1;
		switch (devStep) {
			case 0:
				$scope.dev.people1 = false;
				break;
			case 1:
				$scope.dev.bitbucket1 = false;
				break;
			case 2:
				$scope.dev.arrow1 = false;
				break;
			case 3:
				$scope.dev.laptop = false;
				break;
			case 4:
				$scope.dev.light = false;
				break;
			case 5:
				$scope.dev.arrow2 = false;
				break;
			case 6:
				$scope.dev.chrome = false;
				break;
			case 7:
				$scope.dev.people2 = false;
				break;
			case 8:
				$scope.dev.bitbucket2 = false;
				break;
			case 9:
				$scope.dev.arrow3 = false;
				break;
			case 10:
				$scope.dev.jsfiddle = false;
				break;
			case 11:
				$scope.dev.arrow4 = false;
				break;
			case 12:
				$scope.dev.arrow5 = false;
				break;
		}
	};

	function initDevStatus() {
		$scope.dev = {};
		$scope.dev.people1 = true;
		$scope.dev.people2 = true;
		$scope.dev.bitbucket1 = true;
		$scope.dev.bitbucket2 = true;
		$scope.dev.laptop = true;
		$scope.dev.light = true;
		$scope.dev.chrome = true;
		$scope.dev.jsfiddle = true;
		$scope.dev.arrow1 = true;
		$scope.dev.arrow2 = true;
		$scope.dev.arrow3 = true;
		$scope.dev.arrow4 = true;
		$scope.dev.arrow5 = true;
	}
}

introController.$inject = ['$scope', '$timeout', 'drLoadingService'];
