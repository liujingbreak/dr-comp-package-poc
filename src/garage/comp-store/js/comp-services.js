var api = require('__api');
api.app.factory('compService', ['$q', '$http', function($q, $http) {
	return new CompService($q, $http);
}]);

function CompService($q, $http) {
	this.$q = $q;
	this.$http = $http;
	this.nodeServer = api.config.get([api.packageShortName, 'nodeServer'], '');
}

CompService.prototype = {
	getPackagesAndBanner: function() {
		return this.$http({
			method: 'GET',
			url: this.nodeServer + api.contextPath + '/packageBanner'
		})
		.then(function(res) {
			if (res.data.error)
				throw new Error(res.data.error);
			return {
				packages: res.data.packages
			};
		});
	}
};
