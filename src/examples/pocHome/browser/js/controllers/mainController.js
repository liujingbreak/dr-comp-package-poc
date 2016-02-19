var angular = require('@dr/angularjs');

angular.module('pocHome').controller('MainController', ['$scope', '$timeout',
function($scope, $timeout) {
	var mainVm = this;
	mainVm.title = 'Web House';
	mainVm.loaded = false;
	mainVm.animSlogonStart = false;
	mainVm.animStart = false;
	mainVm.screen1Timeline = new TimelineLite({paused: true});

	$scope.$watch('mainVm.loaded', function(start) {
		if (start) {
			$timeout(function() {
				mainVm.animStart = true;
			}, 1000);
		}
	});
}]);
