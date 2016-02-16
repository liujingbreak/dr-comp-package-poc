var angular = require('@dr/angularjs');

angular.module('pocHome').controller('MainController', ['$scope', function($scope) {
	var mainVm = this;
	mainVm.title = 'Web House';
	mainVm.greeting = 'Hellow world';

	$scope.$watch(function() {
		console.log(mainVm.greeting);
	});
}]);
