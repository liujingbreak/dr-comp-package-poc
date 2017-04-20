var readme = require('@dr/readme');
module.exports = function(controllerProvider) {
	controllerProvider.controller('AsideController', ['$scope',
	'$location', 'drLoadingService',
	function($scope, $location, drLoadingService) {
		var asideVm = this;

		asideVm.menuItems = [
			{
				label: drTranslate('Home'),
				subMenu: [],
				icon: 'fa-home',
				action: function() {
					$location.path('/');
				}
			},
			{
				icon: 'fa-book',
				label: drTranslate('Documentation'),
				subMenu: readme.buildMenu(docName2Route)
			},
			{
				label: drTranslate('Component Store'),
				icon: 'fa-th',
				action: function() {
					$location.path('/components');
				}
			},
			{
				label: drTranslate('Updates'),
				icon: 'fa-newspaper-o',
				action: function() {
					$location.path('/doc/updates.md');
				}
			},
		];

		function docName2Route(name) {
			$location.path('doc/' + name);
		}
	}]);
};

