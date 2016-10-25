require('@dr/angularjs');

module.exports = {
	view: require('./views/main.html'),
	createModule: function(mainModule) {
		mainModule.controllerProvider.register('CompStoreController', ['$scope', CompStoreController]);
	}
};

function CompStoreController($scope) {
	console.log('CompStoreController');
}
