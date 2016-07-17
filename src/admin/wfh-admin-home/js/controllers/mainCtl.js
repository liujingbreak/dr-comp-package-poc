module.exports = function(m) {
	m.controller('MainController', ['$scope', function($scope) {
		var mainVm = this;
		mainVm.loading = true;
		mainVm.components = [];
	}]);
};
