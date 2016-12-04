var msg = require('@dr/readme/i18n');
var _ = require('lodash');
module.exports = function(goFunc) {
	var menuList = [
		{
			label: $translate('Introduction'),
			icon: 'fa-file-text',
			action: function() {
				goFunc('readme-cn.md');
			}
		},  {
			label: $translate('Daily Work'),
			action: function() {
				goFunc('run-platform-as-tool-cn.md');
			}
		}, {
			label: $translate('Package.json Specification'),
			action: function() {
				goFunc('package-spec-cn.md');
			}
		},  {
			label: $translate('Entry Page'),
			//flag: 'new',
			action: function() {
				goFunc('entry-page.md');
			}
		}, {
			label: $translate('Configuration'),
			flag: 'new',
			action: function() {
				goFunc('config.md');
			}
		}, {
			label: $translate('Environment'),
			flag: '',
			action: function() {
				goFunc('dev-env-hints.md');
			}
		}, {
			label: $translate('Decoupling: dependency injection'),
			action: function() {
				goFunc('dependency-injection.md');
			}
		}, {
			label: $translate('API Specification'),
			//flag: 'new',
			action: function() {
				goFunc('api-spec-cn.md');
			}
		}, {
			label: $translate('i18n'),
			flag: 'new',
			action: function() {
				goFunc('i18n.md');
			}
		}, {
			label: $translate('How does it work'),
			action: function() {
				goFunc('how-does-it-work.md');
			}
		}, {
			label: $translate('Deployment and CDN resource'),
			//flag: 'new',
			action: function() {
				goFunc('cdn-bundle.md');
			}
		}, {
			label: $translate('Server side template: Swig'),
			//flag: 'new',
			action: function() {
				goFunc('swig-template.md');
			}
		}, {
			label: $translate('Unit Test'),
			flag: '',
			action: function() {
				goFunc('test.md');
			}
		}, {
			label: $translate('End-to-end Test'),
			//flag: 'new',
			action: function() {
				goFunc('e2etest.md');
			}
		}, {
			label: $translate('I am platform developer'),
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

	return _.reduce(menuList, function(menuList, menu) {
		if (!menu.icon)
			menu.icon = 'fa-file-text';
		return menuList;
	}, menuList);
};

function $translate(key) {
	var value = msg[key];
	return value ? value : key;
}
