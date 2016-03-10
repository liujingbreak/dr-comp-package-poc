var _ = require('lodash');
module.exports = buildScenes;

function buildScenes(scrollControl, iElement, scope) {
	var slogon = iElement.find('.screen-1').find('.center-box');

	var screen2 = iElement.find('.screen-2');

	scrollControl.scene({
		triggerElement: screen2,
		delayPercent: 5,
		startup: function(reverse, offset) {
			if (!reverse) {
				TweenMax.staggerTo(
					_(slogon.children().eq(0).children()).reverse().value(), 0.7,
					{className: '+=invisible', y: 300, rotation: 90,  ease: 'Power2.easeIn'},
					0.07);
			}
		}
	});

	scrollControl.scene({
		triggerElement: screen2,
		delayPercent: 50,
		startup: function(reverse, offset) {
			if (!reverse) {
				scope.introVm.showScreen2Text = true;
				scope.$apply();
			}
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
