var api = require('__api');
var _ = require('lodash');

api.app.component('compCard', {
	controller: ['$scope', '$element', '$location', 'compService', function($scope, $element, $location, compService) {
		var $ctrl = this;
		if ($ctrl.package.author && $ctrl.package.author.name ) {
			compService.selectAvatarByName($ctrl.package.author.name)
				.then(function(response) {
					$ctrl.imgUrl = response.data.url;
				});
		} else {
			$ctrl.imgUrl = false;
		}
		//使得dr.category一定返回一个数组
		var dr_category = _.get($ctrl.package, 'dr.category');
		_.get($ctrl.package, 'dr.category', [].concat(dr_category));
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
					self.onSelect({
						name: $ctrl.package.name
					});
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
