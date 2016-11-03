var readme = require('@dr/readme');
module.exports = function(controllerProvider) {
	controllerProvider.controller('AsideController', ['$scope',
	'$location', 'drLoadingService',
	function($scope, $location, drLoadingService) {
		var asideVm = this;

		asideVm.menuItems = [
			{
				label: $translate('Home'),
				subMenu: [],
				icon: 'fa-home',
				action: function() {
					$location.path('/');
				}
			},
			{
				icon: 'fa-book',
				label: $translate('Documentation'),
				subMenu: readme.buildMenu(docName2Route)
			},
			{
				label: $translate('Component Store'),
				icon: 'fa-th',
				action: function() {
					$location.path('/components');
				}
			}
		];

		function docName2Route(name) {
			$location.path('doc/' + name);
		}
	}]);
};

function $translate(k) {
	return require('@dr/doc-home/i18n')[k] || k;
}
