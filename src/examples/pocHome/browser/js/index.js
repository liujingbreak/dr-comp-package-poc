window.jQuery = require('jquery');
var angular = require('@dr/angularjs');

var pocHome = angular.module('pocHome', ['ngAnimate', 'ngRoute'])
	.config(['$routeProvider', function($routeProvider) {
		//$routeProvider.when('');
	}]);
module.exports = pocHome;
conosole.log(module);
require('./controllers/mainController');
