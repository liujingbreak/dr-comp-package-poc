var api = require('__api');

api.app.component('compDetails', {
	template: require('../views/comp-detail.html'),
	controller: ['$scope', '$stateParams', 'compService', 'drLoadingService',
	function($scope, $stateParams, compService, drLoadingService) {
		this.$onInit = function() {
			var self = this;
			this.compId = decodeURIComponent($stateParams.compId);
			drLoadingService.setLoading('compDetail', true);
			compService.detail(this.compId)
			.then(function(data) {
				self.readme = data.readme;
			})
			.finally(function() {
				drLoadingService.setLoading('compDetail', false);
			});
		};
	}]
});
