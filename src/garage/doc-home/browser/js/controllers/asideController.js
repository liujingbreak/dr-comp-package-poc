module.exports = function(controllerProvider) {
	controllerProvider.controller('AsideController', ['$scope',
	'$location',
	function($scope, $location) {
		var asideVm = this;

		asideVm.menuItems = [
			{
				label: t('Home'),
				subMenu: [],
				action: function() {
					$location.path('/');
				}
			},
			{
				label: t('Documentation'),
				subMenu: [
					{
						label: t('Introduction'),
						action: function() {
							$location.path('doc/readme-cn');
						}
					}, {
						label: t('Quick Start'),
						action: function() {
							$location.path('doc/quickstart-cn');
						}
					}, {
						label: t('Package.json Specification'),
						action: function() {
							$location.path('doc/package-spec-cn');
						}
					}, {
						label: t('API Specification'),
						action: function() {
							$location.path('doc/api-spec-cn');
						}
					}, {
						label: t('TODOs'),
						action: function() {
							$location.path('doc/todo-cn');
						}
					}
				]
			}
		];
	}]);
};
