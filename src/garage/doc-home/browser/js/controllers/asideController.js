var readme = require('@dr/doc-readme');
var _ = require('lodash');
module.exports = function(controllerProvider) {
	controllerProvider.controller('AsideController', ['$scope',
	'$location', 'drLoadingService',
	function($scope, $location, drLoadingService) {
		var asideVm = this;
		var docMenu = _.map(readme.list, item => {
			return {
				label: item.label,
				icon: item.icon,
				flag: item.flag,
				action: () => {
					$location.path('doc/' + item.name);
				}
			};
		});

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
				subMenu: docMenu
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
	}]);
};

