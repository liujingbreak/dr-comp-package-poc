window.jQuery = require('jquery');
var angular = require('@dr/angularjs');

console.log(__filename);
var pocHome = angular.module('pocHome', ['ngAnimate', 'ngRoute'])
	.config(['$routeProvider', function($routeProvider) {
		//$routeProvider.when('');
	}]).controller('AsideController', ['$scope', function($scope) {
		this.name = 'hey';
		console.log($scope);
	}]);
module.exports = pocHome;

require('./controllers/mainController');

angular.element(document).ready(function() {
	angular.bootstrap(document, ['pocHome']);
});
