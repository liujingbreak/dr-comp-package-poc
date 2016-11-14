require('@dr/angularjs');

var initialized = false;
exports.init = function(app, parentRouterState) {
	if (initialized)
		return;
	initialized = true;

	app.$compileProvider.component('compStore', {
		template: require('./views/componentStore.html'),
		controller: function() {
			console.log('Hey there, we have a component store now.');
		}
	});
	app.$compileProvider.component('compDetails', {
		template: '<h1>Details: {{detailsCtrl.compId}}</h1>',
		controller: ['$stateParams', function($stateParams) {
			this.compId = $stateParams.compId;
		}],
		controllerAs: 'detailsCtrl'
	});
};
