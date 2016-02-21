/* global TweenMax, Linear, Power2, TimelineLite */
require('@dr/gsap');
var _ = require('lodash');

module.exports = function(compileProvider) {
	compileProvider.directive('drTextAnim', drTextAnim);
	compileProvider.directive('drClassAnim', drClassAnim);
	compileProvider.directive('drScrollableAnim', drScrollableAnim);
};

function drScrollableAnim(ScrollableAnim, $timeout, $window) {
	return {
		scope: false,
		link: function(scope, iElement, iAttrs, controller) {
			var scrollControl = new ScrollableAnim(iElement, 18);
			scope[iAttrs.drScrollableAnim] = scrollControl;
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
				scope[iAttrs.drScrollableAnim] = scrollControl;
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

function buildScenes(scrollControl, iElement, scope) {
	var slogonPinned = false;
	var slogon = iElement.find('.screen-1').find('.center-box');
	slogon.find('.invisible').removeClass('invisible');
	scrollControl.scene({
		begin: slogon.offset().top - iElement.offset().top,
		duration: 10,
		startup: function(reverse, offset) {
			if (reverse && slogonPinned) {
				slogonPinned = false;
				scrollControl.unpin(slogon);
				return;
			}
			if (slogonPinned) {
				return;
			}
			slogonPinned = true;
			scrollControl.pin(slogon, iElement.offset().top);
		}
	});

	var screen2 = iElement.find('.screen-2');

	scrollControl.scene({
		triggerElement: screen2,
		timeline: function(timeline) {
			timeline.staggerTo(
				_(slogon.children().eq(0).children()).reverse().value(), 0.3,
				{className: '+=invisible', ease: Linear.easeNone},
				0.02);
			timeline.to(slogon.children().eq(0), 0.6, {height: 0, margin: 0, ease: 'Power2.easeOut'});
		},
		teardown: function(reverse, offset) {
			if (!reverse) {
				slogon.addClass('white');
			} else {
				slogon.removeClass('white');
			}
		}
	});

	scrollControl.scene({
		triggerElement: '.screen-2',
		delayPercent: 50,
		startup: function(reverse, offset) {
			if (!reverse) {
				scope.mainVm.showScreen2Text = true;
				scope.$apply();
			}
		}
	});

	scrollControl.scene({
		triggerElement: '.screen-3',
		timeline: function(timeline) {
			timeline.to(slogon, 1, {yPercent: -100, ease: 'Linear.easeNone'});
		}
	});
}

function drTextAnim($timeout) {
	return {
		scope: {
			timeline: '=',
			onComplete: '&',
			drTextAnim: '=',
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
					var height = iElement.prop('clientHeight');
					var width = iElement.prop('clientWidth');
					iElement.css({
						width: width + 'px', height: height + 'px'
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
