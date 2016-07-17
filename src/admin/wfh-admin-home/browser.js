require('@dr/angularjs');
require('@dr/respond-js');

var compListView = require('./views/component-list.html');
var mainModule = angular.module(__api.packageShortName, ['ngAnimate', 'ngRoute']);
require('./js/controllers')(mainModule);
mainModule.run(['$templateCache', function($templateCache) {
		$templateCache.put('component-list', require('./views/component-list.html'));
	}]);

angular.element(document).ready(function() {
	angular.bootstrap(document, [__api.packageShortName]);
});
exports.mainModule = mainModule;
exports.compListView = compListView;
