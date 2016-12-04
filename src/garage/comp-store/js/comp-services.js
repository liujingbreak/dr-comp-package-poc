var api = require('__api');
api.app.factory('compService', ['$q', '$http', function($q, $http) {
	return new CompService($q, $http);
}]);

function CompService($q, $http) {
	this.$q = $q;
	this.$http = $http;
}

CompService.prototype = {
	getPackagesAndBanner: function() {
		return this.$http({
			method: 'GET',
			url: api.contextPath + '/packages'
		})
		.then(function(res) {
			return {
				packages: res.data
			};
		});
	}
};
