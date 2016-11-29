require('@dr/angularjs');

var initialized = false;
exports.init = function(app, parentRouterState) {
	if (initialized)
		return;
	initialized = true;

	app.component('compStore', {
		template: require('./views/componentStore.html'),
		controller: function() {
			console.log('Hey there, we have a component store now.');
			var compStoreVm = this;
			compStoreVm.showNavi = true;
		},
		controllerAs: 'compStoreVm'
	});
	app.component('compDetails', {
		template: '<h1>Details: {{detailsCtrl.compId}}</h1>',
		controller: ['$stateParams', function($stateParams) {
			this.compId = $stateParams.compId;
		}],
		controllerAs: 'detailsCtrl'
	});
};
