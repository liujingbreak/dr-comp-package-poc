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
							$location.path(docName2Route('readme-cn.md'));
						}
					},  {
						label: t('Quick Start: 安装平台 & 开发组建'),
						flag: 'new',
						action: function() {
							$location.path(docName2Route('run-platform-as-tool-cn.md'));
						}
					}, {
						label: t('Quick Start: I am platform developer'),
						flag: 'new',
						action: function() {
							$location.path(docName2Route('quickstart-cn.md'));
						}
					},{
						label: t('Package.json Specification'),
						action: function() {
							$location.path(docName2Route('package-spec-cn.md'));
						}
					}, {
						label: t('环境配置和gulp命令提示'),
						flag: 'new',
						action: function() {
							$location.path(docName2Route('dev-env-hints.md'));
						}
					}, {
						label: t('API Specification'),
						action: function() {
							$location.path(docName2Route('api-spec-cn.md'));
						}
					}, {
						label: t('i18n'),
						action: function() {
							$location.path(docName2Route('i18n.md'));
						}
					}, {
						label: t('How does it work'),
						action: function() {
							$location.path(docName2Route('how-does-it-work.md'));
						}
					}, {
						label: t('Backlog'),
						action: function() {
							$location.path(docName2Route('todo-cn.md'));
						}
					}
				]
			}
		];

		function docName2Route(name) {
			return 'doc/' + name;
		}
	}]);
};
