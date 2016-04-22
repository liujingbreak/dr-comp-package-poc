require('@dr/gsap');
module.exports = function(compileProvider) {
	compileProvider.directive('drInclude', ['$compile', drInclude]);
	compileProvider.directive('drIncludeAnim', ['$compile', drIncludeAnim]);
};

/**
 * ng-include caches response, and animation of 'enter' and 'leave' are not triggered after
 * switch to a cached URL.
 * I need to make sure animation take place everytime switching URL
 */
function drInclude($compile) {
	return {
		restrict: 'A',
		scope: true,
		compile: function(tElement, tAttrs, transclude) {
			tElement.removeAttr('dr-include');
			if (tAttrs.drInclude) {
				tElement.attr('ng-include', tAttrs.drInclude);
			}
			if (tAttrs.src) {
				tElement.attr('src', tAttrs.src);
			}
			if (tAttrs.autoscroll) {
				tElement.attr('autoscroll', tAttrs.autoscroll);
			}
			if (tAttrs.onload) {
				tElement.attr('onload', tAttrs.onload);
			}
			var linkFunc = $compile(tElement);
			return function(scope, iElement, iAttrs) {
				linkFunc(scope);
				scope.$on('$includeContentLoaded', function() {
					TweenMax.fromTo(iElement.next()[0], 0.3,
						{opacity: 0, y: -40},
						{opacity: 1, y: 0, ease: 'Power2.easeOut'});
				});
			};
		}
	};
}

function drIncludeAnim($compile) {
	return {
		restrict: 'C',
		scope: false,
		link: function(scope, iElement, iAttrs) {
			scope.$on('$includeContentLoaded', function() {
				TweenMax.fromTo(iElement[0], 0.3,
					{opacity: 0, y: 40},
					{opacity: 1, y: 0, ease: 'Power2.easeOut'});
			});
		}
	};
}
