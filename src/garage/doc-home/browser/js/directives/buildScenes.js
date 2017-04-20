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

	var funcScreen = iElement.find('.screen-func');
	var funcBlockTimeline = new TimelineLite({paused: true});
	var funcBlock = funcScreen.find(' > .func-blocks');
	funcBlock.children().each(function(idx) {
		funcBlockTimeline.fromTo(this, 0.75,
			{autoAlpha: 0, yPercent: -70}, {autoAlpha: 1, yPercent: 0, ease: 'Bounce.easeOut'}, idx * 0.1);
	});
	scrollControl.scene({
		triggerElement: funcScreen,
		delayPercent: 50,
		duration: Math.max(angular.element(window).height(), funcScreen.prop('offsetHeight')),
		startup: function(reverse, scene) {
			if (!reverse) {
				funcBlockTimeline.play();
			} else {
				funcBlockTimeline.pause();
				funcBlockTimeline.time(0);
			}
		}
		// teardown: function(reverse, scene) {
		// 	if (!reverse)
		// 		scrollControl.pin(funcScreen);
		// 	else
		// 		scrollControl.unpin(funcScreen);
		// }
	});

	// var infraScreen = iElement.children('.screen-infra');
	// scrollControl.scene({
	// 	triggerElement: infraScreen,
	// 	delayPercent: 0,
	// 	duration: angular.element(window).height() + infraScreen.prop('offsetHeight'),
	// 	timeline: function(timeline) {
	// 		timeline.to(funcScreen, 0.5, {yPercent: -100, ease: 'Power2.easeIn'}, 0.5);
	// 	},
	// 	teardown: function(reverse, scene) {
	// 	}
	// });


	//[].slice.call(screens, screens.length - 4, screens.length - 1)
	[
		iElement.children('.screen-3rdparty')[0],
		iElement.children('.screen-concept')[0],
		iElement.children('.screen-package')[0],
		iElement.children('.screen-modules')[0],
		iElement.children('.screen-computer')[0],
		iElement.children('.screen-project')[0],
		iElement.children('.screen-workspace')[0],
		iElement.children('.screen-chunk')[0]
	]
	.forEach(function(theScreen) {
		scrollControl.scene({
			triggerElement: angular.element(theScreen),
			duration: Math.min(angular.element(window).height(), angular.element(theScreen).prop('offsetHeight')),
			delayPercent: 30,
			timeline: function(timeline) {
				timeline.addLabel('s2');
				timeline.from(theScreen, 1, {backgroundColor: 'rgb(0, 171, 144)'});
				timeline.fromTo(theScreen.children[0], 1, {autoAlpha: 0}, {autoAlpha: 1, ease: 'Power2.easeOut'}, 's2');
			}
		});
	});

	scrollControl.scene({
		triggerElement: iElement.children('.screen-computer'),
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
