require('@dr/angularjs');
require('@dr/respond-js');
require('./js/controllers');
var compListView = require('./views/component-list.html');
var mainModule = angular.module(__api.packageShortName, ['ngAnimate', 'ngRoute']);
exports.mainModule = mainModule;
exports.compListView = compListView;
