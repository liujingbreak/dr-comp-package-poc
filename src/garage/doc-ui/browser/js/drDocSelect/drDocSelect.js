require('./drDocSelect.less');
module.exports = function(ngModule) {
	ngModule.directive('drDocSelect', ['$compile', function($compile) {
		return {
			template: require('./drDocSelect.html'),
			scope: {
				options: '<',
				model: '='
			},
			controller: ['$scope', '$element', controller],
			controllerAs: '$ctrl',
			bindToController: true,
			compile: function compile(tElement) {
				tElement.addClass('dr-doc-select');
				return function() {};
			}
		};
	}]);
};

function controller($scope, $element) {
	var self = this;
	var value2display;
	this.$onInit = function() {
		$scope.$watch('$ctrl.model', function(newVal) {
			if (newVal && value2display)
				self.display = value2display[newVal];
		});
	};
	this.$onChanges = function(changes) {
		if (changes.options) {
			value2display = {};
			angular.forEach(changes.options.currentValue, function(option) {
				value2display[option.value] = option.name;
			});
		}
		self.display = value2display[self.model];
	};
}
