module.exports = function(goFunc) {
	return [
		{
			label: t('Introduction'),
			flag: 'new',
			action: function() {
				goFunc('readme-cn.md');
			}
		},  {
			label: t('Daily Work: 安装平台 & 开发组建'),
			flag: 'new',
			action: function() {
				goFunc('run-platform-as-tool-cn.md');
			}
		}, {
			label: t('Package.json Specification'),
			flag: 'new',
			action: function() {
				goFunc('package-spec-cn.md');
			}
		}, {
			label: t('环境配置和gulp命令提示'),
			flag: 'new',
			action: function() {
				goFunc('dev-env-hints.md');
			}
		}, {
			label: t('API Specification'),
			action: function() {
				goFunc('api-spec-cn.md');
			}
		}, {
			label: t('i18n'),
			action: function() {
				goFunc('i18n.md');
			}
		}, {
			label: t('How does it work'),
			action: function() {
				goFunc('how-does-it-work.md');
			}
		}, {
			label: t('Updates'),
			flag: 'new',
			action: function() {
				goFunc('updates.md');
			}
		}, {
			label: t('Quick Start: I am platform developer'),
			action: function() {
				goFunc('quickstart-cn.md');
			}
		},{
			label: t('Backlog'),
			action: function() {
				goFunc('todo-cn.md');
			}
		}
	];
};
