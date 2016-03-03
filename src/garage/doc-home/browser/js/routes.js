
module.exports = function($routeProvider) {
	$routeProvider.when('/', {
		template: require('../views/screens.html'),
		controller: 'IntroController',
		controllerAs: 'introVm'
	});
	$routeProvider.when('/doc/:name', {
		template: require('../views/doc.html'),
		controller: 'DocController',
		controllerAs: 'docVm'
	});
};
