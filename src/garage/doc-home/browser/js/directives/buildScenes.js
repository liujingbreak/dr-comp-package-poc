var _ = require('lodash');
module.exports = buildScenes;

function buildScenes(scrollControl, iElement, scope) {
	// var slogonPinned = false;
	var slogon = iElement.find('.screen-1').find('.center-box');
	// var headerText = slogon.children().eq(1);
	slogon.find('.invisible').removeClass('invisible');

	// scrollControl.scene({
	// 	begin: headerText.offset().top - iElement.offset().top,
	// 	duration: 10,
	// 	startup: function(reverse, offset) {
	// 		if (reverse && slogonPinned) {
	// 			slogonPinned = false;
	// 			scrollControl.unpin(headerText);
	// 			return;
	// 		}
	// 		if (slogonPinned) {
	// 			return;
	// 		}
	// 		slogonPinned = true;
	// 		console.log(headerText.css('marginTop'));
	// 		scrollControl.pin(headerText, iElement.offset().top - headerText.css('marginTop'));
	// 	}
	// });

	var screen2 = iElement.find('.screen-2');

	scrollControl.scene({
		triggerElement: screen2,
		delayPercent: 30,
		// timeline: function(timeline) {
		// 	timeline.staggerTo(
		// 		_(slogon.children().eq(0).children()).reverse().value(), 0.4,
		// 		{className: '+=invisible', y: 800, ease: 'Power2.easeOut'},
		// 		0.016);
		// 	timeline.to(slogon.children().eq(0), 0.6, {height: 0, margin: 0, ease: 'Power2.easeIn'});
		// },
		startup: function(reverse, offset) {
			if (!reverse) {
				TweenMax.staggerTo(
					_(slogon.children().eq(0).children()).reverse().value(), 1,
					{className: '+=invisible', y: 400, rotation: 90,  ease: 'Power2.easeIn'},
					0.07);
			} else {
				scope.mainVm.animStart = true;
				scope.$apply();
			}
		}
	});

	scrollControl.scene({
		triggerElement: screen2,
		delayPercent: 50,
		startup: function(reverse, offset) {
			if (!reverse) {
				scope.mainVm.showScreen2Text = true;
				scope.$apply();
			}
		}
	});
}
