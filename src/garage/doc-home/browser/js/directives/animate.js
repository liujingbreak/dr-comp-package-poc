/* global TweenMax, Power2, TimelineLite */
require('@dr/gsap');
var _ = require('lodash');
var buildScenes = require('./buildScenes');

module.exports = function(compileProvider) {
	compileProvider.directive('drTextAnim', drTextAnim);
	compileProvider.directive('drClassAnim', drClassAnim);
	compileProvider.directive('drScrollableAnim', drScrollableAnim);
};

function drScrollableAnim(ScrollableAnim, $timeout, $window) {
	return {
		scope: false,
		link: function(scope, iElement, iAttrs, controller) {
			iElement.addClass('dr-scrollable-anim');
			var scrollControl = new ScrollableAnim(iElement, 16);
			_.set(scope, iAttrs.drScrollableAnim, scrollControl);
			var slogon = iElement.find('.screen-1').find('.center-box');

			$timeout(function() {
				buildScenes(scrollControl, iElement, scope);
			}, 17, false);

			var windowResize = _.debounce(function() {
				scrollControl.unpin(slogon);
				scrollControl.seek(0);
				scrollControl.destory();
				iElement.scrollTop(0);
				scrollControl = new ScrollableAnim(iElement, 18);
				buildScenes(scrollControl, iElement, scope);
				scope.$apply();
			}, 500);

			var win = angular.element($window).on('resize', windowResize);

			iElement.on('$destory', function() {
				scrollControl.destory();
				win.off('resize', windowResize);
			});
		}
	};
}
drScrollableAnim.$inject = ['ScrollableAnim', '$timeout', '$window'];



function drTextAnim($timeout) {
	return {
		scope: {
			timeline: '=', // optional
			onComplete: '&',
			drTextAnim: '=', // if true, timeline begins
			timelinePos: '@',
			duration: '@'
		},

		compile: function(tElement, tAttrs, transclude) {
			return function(scope, iElement, iAttrs, controller) {
				var timeline;
				if (scope.timeline) {
					timeline = scope.timeline;
				} else {
					timeline = new TimelineLite({paused: true});
				}
				//iElement.addClass('dr-text-anim-hidden');
				var text = iElement.text();
				$timeout(function() {
					var height = iElement.height();
					var width = iElement.width();
					iElement.css({
						minWidth: width + 'px', minHeight: height + 'px'
					});
					iElement.html('');
				}, 0, false);

				timeline.to(iElement[0], parseFloat(scope.duration),
					{text: text, ease: 'Linear.easeNone'},
					scope.timelinePos ? scope.timelinePos : '+=0');

				if (iAttrs.drTextAnim) {
					scope.$watch('drTextAnim', function(newVal) {
						if (newVal) {
							timeline.restart();
						}
					});
				}
			};
		}
	};
}
drTextAnim.$inject = ['$timeout'];

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
