/* global TweenMax, Linear, Power2, TimelineLite */
require('@dr/gsap');

var compileProvider = angular.module('pocHome');
compileProvider.directive('drTextAnim', drTextAnim);

function drTextAnim() {
	return {
		scope: false,
		compile: function(tElement, tAttrs, transclude) {
			return function(scope, iElement, iAttrs, controller) {
				iElement.addClass('dr-text-anim');
				var tl = new TimelineLite({onComplete: function() {}});

				iAttrs.$observe('drTextAnim', function(value) {
					if (scope.$eval(value)) {
						tl.to(iElement[0], 0.7, {text: '', ease: Linear.easeNone});
						tl.to(iElement[0], 1.5, {text: iAttrs.drTextNext, ease: Linear.easeNone});
					}
				});
			};
		}
	};
}

compileProvider.directive('drClassAnim', drClassAnim);
function drClassAnim() {
	return {
		scope: false,
		compile: function(tElement, tAttrs, transclude) {
			return function(scope, iElement, iAttrs, controller) {
				iAttrs.$observe('drClassAnim', function(value) {
					if (value) {
						TweenMax.to(iElement[0], 0.5, {className: '+=' + value, ease: Power2.easeOut});
					}
				});
			};
		}
	};
}
