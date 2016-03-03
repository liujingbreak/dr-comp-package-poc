module.exports = function(controllerProvider) {
	controllerProvider.controller('IntroController', introController);
};

function introController($scope, $timeout) {
	var introVm = this;
	$scope.mainVm.selectedMenuIdx = 0;
	introVm.animSlogonStart = false;
	introVm.animStart = false;
	introVm.screen1Timeline = new TimelineLite({paused: true});
	introVm.screen2Timeline = new TimelineLite({paused: true});
	$scope.$watch('mainVm.loaded', function(start) {
		if (start) {
			$timeout(function() {
				introVm.animStart = true;
			}, 500);
		}
	});
}

introController.$inject = ['$scope', '$timeout'];
