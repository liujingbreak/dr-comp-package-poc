/* globals DISQUS */
var readme = require('@dr/readme');
var locale = 'cn';

module.exports = function(controllerProvider) {
	controllerProvider.controller('DocController',
	['$scope',
	'$timeout',
	'$stateParams',
	'drLoadingService',
	controller]);
};

function controller($scope, $timeout, $stateParams, drLoadingService) {
	var docVm = this;

	$scope.mainVm.selectedMenuIdx = 1;

	var file = $stateParams.docPath.substring(0, $stateParams.docPath.lastIndexOf('.'));

	docVm.docAddress = __api.assetsUrl('readme-docs', docName2Route(file));

	$scope.$on('$includeContentRequested', function() {
		drLoadingService.setLoading('main', true);
	});
	$scope.$on('$includeContentLoaded', stopLoading);
	$scope.$on('$includeContentError', stopLoading);

	function stopLoading() {
		drLoadingService.setLoading('main', false);
		$timeout(function() {
			if (window.DISQUS)
				DISQUS.reset({
					reload: true,
					config: function() {
						this.page.identifier = file;
						this.page.url = '//' + docVm.docAddress;
						this.page.title = docVm.docAddress;
					}
				});
		}, 0);
	}
}

function docName2Route(name) {
	var mdPath = readme.manifest[locale + '/' + name + '.md'];
	return mdPath.substring(0, mdPath.lastIndexOf('.')) + '.html';
}
