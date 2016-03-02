module.exports = function(controllerProvider) {
	controllerProvider.controller('MainController', MainController);
};

function MainController($scope, $timeout) {
	var mainVm = this;
	mainVm.loaded = false;
}

MainController.$inject = ['$scope', '$timeout'];
