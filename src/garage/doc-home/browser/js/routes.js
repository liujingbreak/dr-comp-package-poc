
console.log(__api.contextPath);
module.exports = function($routeProvider) {
	$routeProvider.when('/', {
		template: require('../views/screens.html')
	});
	$routeProvider.when('/readmes/:name', {
		templateUrl: __api.contextPath + 'rest/readmes'
	});
};
