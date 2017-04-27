/* globals DISQUS */
var readme = require('@dr/doc-readme');

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

	//var file = $stateParams.docPath.substring(0, $stateParams.docPath.lastIndexOf('.'));

	docVm.docAddress = readme.map[$stateParams.docPath].url;

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
						this.page.identifier = $stateParams.docPath;
						this.page.url = '//' + docVm.docAddress;
						this.page.title = docVm.docAddress;
					}
				});
		}, 0);
	}
}

