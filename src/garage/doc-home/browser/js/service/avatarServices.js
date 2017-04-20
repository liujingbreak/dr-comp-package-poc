var api = require('__api');

module.exports = function(curModule) {
	curModule.factory('avatarService', ['$q', '$http', '$timeout', function($q, $http, $timeout) {
		function AvatarService($q, $http, $timeout) {
			this.$q = $q;
			this.$http = $http;
			this.nodeServer = api.config.get([api.packageName, 'nodeServer'], '');
		}

		AvatarService.prototype = {
			avatarList: function() {
				return this.$http({
						method: 'GET',
						url: this.nodeServer + 'comp-store/avatar/list'
					})
					.then(function(res) {
						if (res.data.error)
							throw new Error(res.data.error);
						return {
							data: res.data
						};
					});
			},
			avatarAdd: function(id, url) {
				return this.$http({
						method: 'POST',
						url: this.nodeServer + 'comp-store/avatar/add',
						data: {
							id: id,
							url: url
						}
					})
					.then(function(res) {
						if (res.data.error)
							throw new Error(res.data.error);
						return {
							data: res.data
						};
					});
			},
			avatarEdit: function(userId, id, url) {
				return this.$http({
						method: 'POST',
						url: this.nodeServer + 'comp-store/avatar/edit',
						data: {
							userId: userId,
							id: id,
							url: url
						}
					})
					.then(function(res) {
						if (res.data.error)
							throw new Error(res.data.error);
						return {
							data: res.data
						};
					});
			},
			avatarDelete: function(userId) {
				return this.$http({
						method: 'POST',
						url: this.nodeServer + 'comp-store/avatar/delete',
						data: {
							userId: userId
						}
					})
					.then(function(res) {
						if (res.data.error)
							throw new Error(res.data.error);
						return {
							data: res.data
						};
					});
			}

		};
		return new AvatarService($q, $http, $timeout);
	}]);
};
