
module.exports = function($routeProvider) {
	$routeProvider.when('/', {
		template: require('../views/screens.html'),
		controller: 'IntroController',
		controllerAs: 'introVm'
	});
	$routeProvider.when('/doc/:docPath*', {
		template: require('../views/doc.html'),
		controller: 'DocController',
		controllerAs: 'docVm'
	});
	$routeProvider.when('/components', {
		template: '<h1>Component Store</h1><h1>{{loaderVM.message}}</h1>',
		controller: 'SplitLoadController',
		controllerAs: 'loaderVM',
		resolve: {
			loaded: ['$q', '$timeout', loadComponentsStoreModule]
		}
	});
};

function loadComponentsStoreModule($q, $timeout) {
	var defer = $q.defer();
	console.log(require);
	require.ensure(['@dr/comp-store'], function(require) {
		defer.resolve(require('@dr/comp-store'));
	});
	return defer.promise;
}
