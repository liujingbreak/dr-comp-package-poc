
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
};
