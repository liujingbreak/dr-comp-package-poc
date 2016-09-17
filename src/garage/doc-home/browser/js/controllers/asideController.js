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
				action: function() {
					$location.path('/');
				}
			},
			{
				label: $translate('Documentation'),
				subMenu: readme.buildMenu(docName2Route)
			},
			{
				label: $translate('Component Store'),
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
