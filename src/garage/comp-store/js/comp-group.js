var api = require('__api');

api.app.component('compGroup', {
	template: '<div ng-repeat="pk in cg.packages">{{pk}}</div>',
	controller: ['compService', function(compService) {
		var cg = this;
		compService.getPackagesAndBanner()
		.then(function(data) {
			cg.packages = data.packages;
		});
	}],
	controllerAs: 'cg'
});
