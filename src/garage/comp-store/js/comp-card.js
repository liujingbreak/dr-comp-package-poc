var api = require('__api');

api.app.component('compCard', {
	controller: ['$scope', '$element', function($scope, $element) {
		this.$onChanges = function(changes) {
			if (changes.cardWidth) {
				//$element.css('width', 'calc(' + changes.cardWidth.currentValue + '% - 2px)');
				$element.css('width', changes.cardWidth.currentValue + '%');
			}
		};
		// this.$postLink = function() {
		// 	$element.on('mouseenter', function(evt) {
		// 		$element.addClass('mouseover')
		// 	});
		// };
	}],
	template: require('../views/comp-card.html'),
	bindings: {
		package: '<',
		cardWidth: '<'
	}
});
