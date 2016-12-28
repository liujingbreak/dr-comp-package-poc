var api = require('__api');
api.app.factory('compService', ['$q', '$http', '$timeout', function($q, $http, $timeout) {
	function CompService($q, $http, $timeout) {
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
			// .then(function(res) {
			// 	return $timeout(()=> res, 3000);
			// })
			.then(function(res) {
				if (res.data.error)
					throw new Error(res.data.error);
				return {
					packages: res.data.packages
				};
			});
		},

		searchPackage: function(anything) {
			return $http({method: 'GET',
				url: this.nodeServer + api.contextPath + '/searchPackage/' + encodeURIComponent(anything)})
			.then(function(res) {
				if (res.data.error)
					throw new Error(res.data.error);
				return {
					packages: res.data.packages
				};
			});
		}
	};
	return new CompService($q, $http, $timeout);
}]);
