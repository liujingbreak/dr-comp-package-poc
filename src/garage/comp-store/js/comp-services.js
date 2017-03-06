var api = require('__api');
api.app.factory('compService', ['$q', '$http', '$timeout', function($q, $http, $timeout) {
	function CompService($q, $http, $timeout) {
		this.$q = $q;
		this.$http = $http;
		this.nodeServer = api.config.get([api.packageShortName, 'nodeServer'], '');
	}

	CompService.prototype = {
		getPackagesAndBanner: function(page, pageSize) {
			return this.$http({
					method: 'GET',
					url: this.nodeServer + api.contextPath + '/packageBanner?page=' + page + '&pageSize=' + pageSize,
				})
				// .then(function(res) {
				// 	return $timeout(()=> res, 3000);
				// })
				.then(function(res) {
					if (res.data.error)
						throw new Error(res.data.error);
					return {
						packages: res.data.packages,
						page: res.data.page,
						pageSize: res.data.pageSize,
						totalPage: res.data.totalPage
					};
				});
		},

		searchPackage: function(page, pageSize, anything) {
			return $http({
					method: 'GET',
					url: this.nodeServer + api.contextPath + '/searchPackage/' + encodeURIComponent(anything) + '?page=' + page + '&pageSize=' + pageSize
				})
				.then(function(res) {
					if (res.data.error)
						throw new Error(res.data.error);
					return {
						packages: res.data.packages,
						page: res.data.page,
						pageSize: res.data.pageSize,
						totalPage: res.data.totalPage
					};
				});
		},

		detail: function(packageName, version) {
			return $http({
					method: 'GET',
					url: this.nodeServer + api.contextPath + '/details/' + encodeURIComponent(packageName) + '/' + version
				})
				.then(function(res) {
					if (res.data.error)
						throw new Error(res.data.error);
					return res.data;
				});
		}
	};
	return new CompService($q, $http, $timeout);
}]);
