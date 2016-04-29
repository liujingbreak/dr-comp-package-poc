module.exports = function(goFunc) {
	return [
		{
			label: $translate('Introduction'),
			action: function() {
				goFunc('readme-cn.md');
			}
		},  {
			label: $translate('Daily Work: 安装平台 & 开发组建'),
			action: function() {
				goFunc('run-platform-as-tool-cn.md');
			}
		}, {
			label: $translate('Package.json Specification'),
			flag: 'new',
			action: function() {
				goFunc('package-spec-cn.md');
			}
		}, {
			label: $translate('环境配置和gulp命令提示'),
			action: function() {
				goFunc('dev-env-hints.md');
			}
		}, {
			label: $translate('API Specification'),
			flag: 'new',
			action: function() {
				goFunc('api-spec-cn.md');
			}
		}, {
			label: $translate('i18n'),
			flag: '',
			action: function() {
				goFunc('i18n.md');
			}
		}, {
			label: $translate('How does it work'),
			action: function() {
				goFunc('how-does-it-work.md');
			}
		}, {
			label: $translate('Test'),
			flag: '',
			action: function() {
				goFunc('test.md');
			}
		}, {
			label: $translate('Updates'),
			flag: 'new',
			action: function() {
				goFunc('updates.md');
			}
		}, {
			label: $translate('Quick Start: I am platform developer'),
			action: function() {
				goFunc('quickstart-cn.md');
			}
		},{
			label: $translate('Backlog'),
			action: function() {
				goFunc('todo-cn.md');
			}
		}
	];
};
