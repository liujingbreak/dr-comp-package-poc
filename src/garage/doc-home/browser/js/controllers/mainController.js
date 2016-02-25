var angular = require('@dr/angularjs');

module.exports = function(controllerProvider) {
	controllerProvider.controller('MainController', MainController);
};

function MainController($scope, $timeout) {
	var mainVm = this;
	mainVm.title = 'Web House';
	mainVm.loaded = false;
	mainVm.animSlogonStart = false;
	mainVm.animStart = false;
	mainVm.screen1Timeline = new TimelineLite({paused: true});
	mainVm.screen2Timeline = new TimelineLite({paused: true});

	$scope.$watch('mainVm.loaded', function(start) {
		if (start) {
			$timeout(function() {
				mainVm.animStart = true;
			}, 500);
		}
	});
}

MainController.$inject = ['$scope', '$timeout'];
