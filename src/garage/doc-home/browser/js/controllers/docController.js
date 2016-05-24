var readme = require('@dr/readme');
var locale = 'cn';

module.exports = function(controllerProvider) {
	controllerProvider.controller('DocController',
	['$scope',
	'$timeout',
	'$routeParams',
	controller]);
};

function controller($scope, $timeout, $routeParams) {
	var docVm = this;

	$scope.mainVm.selectedMenuIdx = 1;

	var file = $routeParams.docPath.substring(0, $routeParams.docPath.lastIndexOf('.'));

	docVm.docAddress = __api.assetsUrl('readme-docs', docName2Route(file));
	$scope.mainVm.loaded = true;
}

function docName2Route(name) {
	var mdPath = readme.manifest[locale + '/' + name + '.md'];
	return mdPath.substring(0, mdPath.lastIndexOf('.')) + '.html';
}
