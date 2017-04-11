//var _ = require('lodash');
module.exports = buildScenes;

function buildScenes(scrollControl, iElement, scope) {
	//var slogon = iElement.find('.screen-1').find('.center-box');
	var scr1Parallex = angular.element('.parallex-layer.scr-1');
	var screen2 = iElement.find('.screen-2');

	var d1 = scr1Parallex.prop('offsetHeight');
	scrollControl.scene({
		triggerElement: screen2,
		duration: d1,
		//delayPercent: 5,
		timeline: function(timeline) {
			timeline.to(scr1Parallex, 1, {y: -d1, autoAlpha: 0, ease: 'Power2.easeIn'});
		}
	});

	scrollControl.scene({
		triggerElement: screen2,
		delayPercent: 20,
		timeline: function(timeline) {
			timeline.addLabel('s2');
			timeline.to(screen2[0], 1, {backgroundColor: '#ffffff', ease: 'Power2.easeOut'});
			timeline.fromTo(screen2[0].children[0], 1, {autoAlpha: 0}, {autoAlpha: 1, ease: 'Power2.easeOut'}, 's2');
		},
		startup: function(reverse, offset) {
			// if (!reverse) {
			// 	scope.introVm.showScreen2Text = true;
			// 	scope.$apply();
			// }
		}
	});

	var screen3 = iElement.find('.screen-3');
	scrollControl.scene({
		triggerElement: screen3,
		delayPercent: 50,
		startup: function(reverse, offset) {
			if (!reverse) {
				scope.introVm.showScreen3Text = true;
				scope.$apply();
			}
		}
	});
}
