//var AnimQ = require('../service/animQueue');
module.exports = function(compileProvider) {
	compileProvider.directive('drDocHome', ['$timeout',
	docHome]);
};

function docHome($timeout) {
	return {
		scope: false,
		controller: ['$scope', '$element', '$attrs', '$parse',
		function($scope, $element, $attrs, $parse) {
			var AnimQ = require('../service/animQueue');
			this.menuOpened = false;
			var bodyVm = this;
			var self = this;

			self.menuEnter = function(size) {
				if (bodyVm.menuOpened) {
					return;
				}
				TweenMax.killTweensOf(bodyVm.mainSection[0]);
				TweenMax.to(bodyVm.mainSection[0], 0.25, {x: size.width - 66, ease: 'Power2.easeOut'});
				bodyVm.menuOpened = true;
			};

			self.menuUnexpand = self.menuExpand = function(size) {
				TweenMax.killTweensOf(bodyVm.mainSection[0]);
				TweenMax.to(bodyVm.mainSection[0], 0.25, {x: size.width - 66, ease: 'Power2.easeOut'});

			};

			self.menuLeave = function() {
				if (!bodyVm.menuOpened) {
					return;
				}
				TweenMax.killTweensOf(bodyVm.mainSection[0]);
				TweenMax.to(bodyVm.mainSection[0], 0.25, {x: 0, ease: 'Power2.easeOut'});
				bodyVm.menuOpened = false;
			};
		}],

		controllerAs: 'bodyVm',

		link: function(scope, iElement, iAttrs, controller) {
			$timeout(function() {
				scope.bodyVm.mainSection = iElement.find('.main-section');
			}, 0, false);
		}
	};
}
