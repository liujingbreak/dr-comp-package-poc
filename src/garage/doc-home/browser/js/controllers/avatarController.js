module.exports = function(controllerProvider) {
	controllerProvider.controller('AvatarController', ['$scope',
		'$timeout',
		'drLoadingService',
		'avatarService',
		controller
	]);
};

function controller($scope, $timeout, drLoadingService, avatarService) {
	var avatarVm = this;
	drLoadingService.setLoading('main', false);
	getList();

	$scope.addOne = function() {
		//只能新增一列
		if (avatarVm.list.length === 0 || (avatarVm.list[avatarVm.list.length - 1] && avatarVm.list[avatarVm.list.length - 1].id)) {
			avatarVm.list.push({});
		}
	};

	$scope.saveRecord = function(event, userId) {
		var target = angular.element(event.target);
		var inputId = target.parent().parent().find('.input-id').val();
		var inputUrl = target.parent().parent().find('.input-url').val();
		if (userId) {
			//修改
			avatarService.avatarEdit(userId, inputId, inputUrl)
				.then(function(response) {
					$scope.errMsg = '修改成功';
					clearMsg();
				}).finally(function() {
					getList();
				});
		} else {
			//新增
			if (!inputId || !inputUrl) {
				$scope.errMsg = '用户ID 与 头像路径 都是必填项';
				clearMsg();
				return;
			}
			avatarService.avatarAdd(inputId, inputUrl)
				.then(function(response) {
					$scope.errMsg = '新增成功';
					clearMsg();
				}).finally(function() {
					getList();
				});
		}
	};

	$scope.delRecord = function(userId) {
		avatarService.avatarDelete(userId)
			.then(function(response) {
				$scope.errMsg = '删除成功';
				clearMsg();
			}).finally(function() {
				getList();
			});
	};

	function getList() {
		avatarVm.list = [];
		avatarService.avatarList()
			.then(function(response) {
				avatarVm.list = response.data;
			});
	}

	function clearMsg() {
		$timeout(function() {
			$scope.errMsg = '';
		}, 3000);
	}
}
