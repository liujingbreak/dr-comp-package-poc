var _ = require('lodash');

exports.init = init;

function init(moduleName) {
	var m = _.isString(moduleName) ? angular.module(moduleName) : moduleName;
	m.directive('t', ['drTranslateService', translateFactory]);
	m.directive('translate', ['drTranslateService', translateFactory]);
	m.directive('translateScope', [translateScopeFactory]);
	m.service('drTranslateService', function() {
		this.resource = {$defaultScope: {}};
		this.addResource = function(translateScope, res) {
			if (arguments.length === 1) {
				this.resource.$defaultScope = res;
			}
			this.resource[translateScope] = res;
		};
	});
}

function translateFactory(drTranslateService) {
	return {
		restrict: 'AC',
		scope: false,
		link: function(scope, iElement, iAttrs) {
			var translated = _.get(drTranslateService.resource, [
				scope.$drTransScope || '$defaultScope',
				iElement.html()
			]);
			if (translated) {
				iElement.html(translated);
			}
		}
	};
}

function translateScopeFactory() {
	return {
		restrict: 'AC',
		scope: false,
		link: function(scope, iElement, iAttrs) {
			iAttrs.$observe('translateScope', function(newVal) {
				if (newVal)
					scope.$drTransScope = newVal;
			});
		}
	};
}
