require('@dr/angularjs');
var api = require('__api');

var initialized = false;
exports.init = function(app) {
	// Set app as a property of API instance, so that all the files from this package can access it
	// There is only one API instance for each package, it can share stuff cross files within same package.
	api.app = app;
	if (initialized)
		return;
	initialized = true;

	app.component('compStore', {
		template: require('./views/componentStore.html'),
		controller: ['compService', function(compService) {
			var compStoreVm = this;
			compStoreVm.showNavi = true;
			compStoreVm.quickSearch = drTranslate('搜索组件和小应用');

			compService.getPackagesAndBanner()
			.then(function(data) {
				compStoreVm.banner = data.banner;
				compStoreVm.packages = data.packages;
			});
		}],
		controllerAs: 'compStoreVm'
	});
	app.component('compDetails', {
		template: '<h1>Details: {{detailsCtrl.compId}}</h1>',
		controller: ['$stateParams', function($stateParams) {
			this.compId = $stateParams.compId;
		}],
		controllerAs: 'detailsCtrl'
	});
	require('./js/comp-services');
	require('./js/comp-group');
	require('./js/comp-card');
};
