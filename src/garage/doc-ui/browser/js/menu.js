module.exports = function(module) {
	module.directive('drMenu', drMenu);
};

function drMenu() {
	return {
		link: function(scope, iElement, iAttrs) {
			iElement.addClass('dr-menu');
		}
	};
}

// function drMenuItem() {
// 	return {
// 		compile: function(tElement, tAttrs, transclude) {
//
// 			return function(scope, iElement, iAttrs, controller) {
//
// 			}
// 		}
// 	}
// }
