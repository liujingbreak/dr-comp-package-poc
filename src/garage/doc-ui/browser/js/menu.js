module.exports = function(module) {
	module.directive('drMenu', ['$timeout',
	'$parse', drMenu]);
};

function drMenu($timeout, $parse) {
	return {
		scope: false,
		link: function(scope, iElement, iAttrs) {
			iElement.addClass('dr-menu');

			scope.clickMenuItem = function(item) {
				if (item.action) {
					item.action();
				} else {
					item.subMenu[0].action();
				}
			};
			$timeout(function() {
				var liList = iElement.children();
				scope.$watch(iAttrs.menuSelected, function(value) {
					if (value == null) {
						return;
					}
					liList.removeClass('dr-checked');
					var li = liList.eq(parseInt(value, 10));
					li.addClass('dr-checked');
				});
			}, 0, false);
		}
	};
}
