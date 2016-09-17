var _ = require('lodash');

exports.create = function(ngModule) {
	ngModule.factory('drLoadingService', ['$rootScope', function($rootScope) {
		var indicatorMap = {};
		return {
			setLoading: function(id, show) {
				if (arguments.length < 2)
					throw new Error('Expect 2 arguments');
				indicatorMap[id] = show;
			},
			isLoading: function(id) {
				return _.has(indicatorMap, id) ? indicatorMap[id] : true;
			}
		};
	}]);

	ngModule.directive('drLoadingIndicator', ['drLoadingService', function(drLoadingService) {
		return {
			restrict: 'AE',
			scope: false,
			template: '<img src="' + __api.assetsUrl('loading.svg') + '"/>',
			compile: function(tElement, tAttrs, transclude) {
				tElement.addClass('dr-loading-indicator');
				return function(scope, iElement, iAttrs) {
					var id = iAttrs.drLoadingIndicator;
					scope.$watch(function() {
						return drLoadingService.isLoading(id);
					}, function(newVal, oldVal) {
						if (newVal)
							iElement.css('display', 'block');
						else
							iElement.css('display', 'none');
					});
				};
			}
		};
	}]);
};
