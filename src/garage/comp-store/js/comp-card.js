var api = require('__api');

api.app.component('compCard', {
	controller: ['$scope', '$element', '$location', function($scope, $element, $location) {
		var $ctrl = this;

		var env = '/comp-store/avatars/';
		if($ctrl.package.author && $ctrl.package.author.name) {
			if($ctrl.package.author.name.toLowerCase().indexOf('jing') !== -1) {
				$ctrl.package.author.name = 'LJ';
			}
			$scope.imgUrl = env + decodeURIComponent($ctrl.package.author.name) + '.jpg';
		}else{
			$scope.imgUrl = env +'default.png';
		}
		
		this.$onChanges = function(changes) {
			if (changes.cardWidth) {
				//$element.css('width', 'calc(' + changes.cardWidth.currentValue + '% - 2px)');
				$element.css('width', changes.cardWidth.currentValue + '%');
			}
		};
		this.$postLink = function() {
			var self = this;
			$element.on('mousedown', function(evt) {
				$element.addClass('press');
			});
			$element.on('mouseup mouseleave', function(evt) {
				$element.removeClass('press');
			});
			$element.on('click', function(evt) {
				$location.path('/components/' + encodeURIComponent($ctrl.package.name));
				if (self.onSelect)
					self.onSelect({name: $ctrl.package.name});
				$scope.$apply();
			});
		};
	}],
	template: require('../views/comp-card.html'),
	bindings: {
		package: '<',
		cardWidth: '<',
		onSelect: '&'
	}
});
