var api = require('__api');
var _ = require('lodash');

api.app.component('compGroup', {
	controller: ['$scope', '$window', '$element', '$timeout', function($scope, $window, $element, $timeout) {
		var $ctrl = this;
		var win = angular.element($window);
		var resizeHandler = _.throttle(calculateCardWidth, 500);
		var cardMinWidth;
		this.$onInit = function() {
			cardMinWidth = parseInt($ctrl.cardMinWidth, 10);
		};

		this.$postLink = function() {
			$timeout(calculateCardWidth, 0, false);
			win.on('resize', resizeHandler);
		};
		this.$onDestroy = function() {
			win.off('resize', resizeHandler);
		};

		function calculateCardWidth() {
			var groupWidth = $element.prop('clientWidth');
			var colCount = parseInt(groupWidth / cardMinWidth, 10);
			var cardWidth = Math.floor(1000 / colCount) / 10;
			$ctrl.onChangeCardWidth({width: cardWidth});
			$scope.$apply();
		}
	}],
	bindings: {
		onChangeCardWidth: '&',
		cardMinWidth: '@'
	}
});
