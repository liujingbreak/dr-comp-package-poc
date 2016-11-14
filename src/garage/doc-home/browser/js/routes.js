
module.exports = function($stateProvider, $urlRouterProvider) {
	$urlRouterProvider.when('', '/');
	$stateProvider.state('home', {
		url: '/',
		views: {
			main: {
				template: require('../views/screens.html'),
				controller: 'IntroController',
				controllerAs: 'introVm'
			}
		}
	});
	$stateProvider.state('doc', {
		url: '/doc/:docPath',
		views: {
			main: {
				template: require('../views/doc.html'),
				controller: 'DocController',
				controllerAs: 'docVm'
			}
		}
	});
	require('@dr/comp-store/routes')($stateProvider);
};
