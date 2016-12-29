var api = require('__api');

api.app.component('compCard', {
	controller: ['$scope', '$element', '$location', function($scope, $element, $location) {
		var $ctrl = this;
		this.$onChanges = function(changes) {
			if (changes.cardWidth) {
				//$element.css('width', 'calc(' + changes.cardWidth.currentValue + '% - 2px)');
				$element.css('width', changes.cardWidth.currentValue + '%');
			}
		};
		this.$postLink = function() {
			$element.on('mousedown', function(evt) {
				$element.addClass('press');
			});
			$element.on('mouseup', function(evt) {
				$element.removeClass('press');
			});
			$element.on('click', function(evt) {
				$location.path('/components/' + encodeURIComponent($ctrl.package.name));
				$scope.$apply();
			});
		};
	}],
	template: require('../views/comp-card.html'),
	bindings: {
		package: '<',
		cardWidth: '<'
	}
});
