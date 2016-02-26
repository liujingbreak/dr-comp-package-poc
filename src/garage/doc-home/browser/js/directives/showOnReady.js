module.exports = function(compileProvider) {
	compileProvider.directive('drShowOnReady', showOnReady);
};

/**
 * Before AnglarJS taking over rendering, there is a moment user can see
 * those raw stuffs which are not compiled by AnguarJS yet, they are ugly, we can
 * simply add a `invisible` class name to the root element and later on use this
 * directive to remove it, so that user won't be able to peek ugly stuff.
 * But this is againts Incremental Rendering principle.
 * @return {[type]} [description]
 */
function showOnReady($timeout) {
	return {
		scope: false,
		link: function(scope, iElement, iAttrs, controller) {
			$timeout(function() {
				iElement.removeClass('invisible');
			}, 0, false);
		}
	};
}

showOnReady.$inject = ['$timeout'];
