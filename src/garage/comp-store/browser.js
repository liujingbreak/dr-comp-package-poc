require('@dr/angularjs');
var api = require('__api');
var _ = require('lodash');

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
		controller: ['$scope', 'compService', 'drLoadingService', function($scope, compService, drLoadingService) {
			var compStoreVm = this;
			compStoreVm.showNavi = true;

			this.$onInit = function() {
				compStoreVm.quickSearch = drTranslate('搜索组件和小应用');
				listPackages();

				$scope.$watch('compStoreVm.nameSearch', search);
			};

			var searchCount = 0;
			var search = _.debounce(function(text, old) {
				if (text) {
					var index = ++searchCount;
					drLoadingService.setLoading('compStore', true);
					compService.searchPackage(text)
					.then(function(data) {
						if (index === searchCount)
							compStoreVm.packages = data.packages;
					})
					.finally(function() {
						drLoadingService.setLoading('compStore', false);
					});
				} else if (text !== old){
					listPackages();
				}
			}, 800);

			function listPackages() {
				drLoadingService.setLoading('compStore', true);
				compService.getPackagesAndBanner()
				.then(function(data) {
					compStoreVm.banner = data.banner;
					compStoreVm.packages = data.packages;
				})
				.finally(function() {
					drLoadingService.setLoading('compStore', false);
				});
			}
			// this.$onChanges = function(changes) {
			// 	debugger;
			// 	if (changes.nameSearch) {
			// 		console.log('search %s', changes.nameSearch.currentValue);
			// 	}
			// };
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
