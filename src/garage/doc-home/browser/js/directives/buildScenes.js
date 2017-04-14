//var _ = require('lodash');
module.exports = buildScenes;

function buildScenes(scrollControl, iElement, scope) {
	//var slogon = iElement.find('.screen-1').find('.center-box');
	var scr1Parallex = angular.element('.parallex-layer.scr-1');
	var screens = iElement.find('.screen');
	var d1 = scr1Parallex.prop('offsetHeight');
	scrollControl.scene({
		triggerElement: screens.eq(1),
		duration: d1,
		//delayPercent: 5,
		timeline: function(timeline) {
			timeline.to(scr1Parallex, 1, {y: -d1, autoAlpha: 0, ease: 'Power2.easeIn'});
		}
	});

	scrollControl.scene({
		triggerElement: screens.eq(1),
		delayPercent: 20,
		startup: function(reverse, offset) {
			if (!reverse) {
				// TODO: optimize
				TweenMax.staggerFromTo([].slice.call(screens[1].children, 0, 2), 0.6, {autoAlpha: 0, xPercent: -50}, {autoAlpha: 1, xPercent: 0, ease: 'Power2.easeOut', paused: false}, 0.1);
				TweenMax.staggerFromTo([].slice.call(screens[1].children, 2), 0.6, {autoAlpha: 0, xPercent: 50}, {autoAlpha: 1, xPercent: 0, ease: 'Power2.easeOut', paused: false}, 0.1);
			}
		}
	});

	scrollControl.scene({
		triggerElement: screens.eq(3),
		delayPercent: 30,
		timeline: function(timeline) {
			timeline.addLabel('s2');
			timeline.to(screens[3], 1, {backgroundColor: '#ffffff', ease: 'Power2.easeOut'});
			timeline.fromTo(screens[3].children[0], 1, {autoAlpha: 0}, {autoAlpha: 1, ease: 'Power2.easeOut'}, 's2');
		},
		startup: function(reverse, offset) {
			// if (!reverse) {
			// 	scope.introVm.showScreen2Text = true;
			// 	scope.$apply();
			// }
		}
	});

	scrollControl.scene({
		triggerElement: screens.eq(2),
		delayPercent: 50,
		startup: function(reverse, offset) {
			if (!reverse) {
				scope.introVm.showScreen2Text = true;
				scope.$apply();
			}
		}
	});

	scrollControl.scene({
		triggerElement: screens.eq(screens.length - 1),
		delayPercent: 50,
		startup: function(reverse, offset) {
			if (!reverse) {
				scope.introVm.showScreen3Text = true;
				scope.$apply();
			}
		}
	});
}
