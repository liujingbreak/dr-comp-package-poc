var _ = require('lodash');

var menuList = [
	{
		label: drTranslate('drcp 内部开发说明'),
		name: 'drcp-developer',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/drcp-developer.md')
	},
	{
		label: drTranslate('开发和命令行工具'),
		flag: 'new',
		name: 'command-line',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/command-line.md')
	},
	{
		label: drTranslate('扩展Webpack配置'),
		flag: 'new',
		name: 'webpack-extend',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/webpack-extend.md')
	},
	{
		label: drTranslate('[Deprecated] Introduction'),
		name: 'readme-cn',
		icon: 'fa-file-text',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/readme-cn.md')
	},
	{
		label: drTranslate('[Deprecated] Daily Work'),
		name: 'run-platform-as-tool-cn',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/run-platform-as-tool-cn.md')
	}, {
		label: drTranslate('[Deprecated] Package.json Specification'),
		name: 'package-spec-cn',
		//flag: 'new',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/package-spec-cn.md')
	},  {
		label: drTranslate('[Deprecated] Entry Page'),
		name: 'entry-page',
		//flag: 'new',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/entry-page.md')
	}, {
		label: drTranslate('[Deprecated] Configuration'),
		name: 'config',
		//flag: 'new',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/config.md')
	}, {
		label: drTranslate('[Deprecated] Environment'),
		name: 'dev-env-hints',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/dev-env-hints.md')
	}, {
		label: drTranslate('[Deprecated] Decoupling: dependency injection'),
		name: 'dependency-injection',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/dependency-injection.md')
	}, {
		label: drTranslate('[Deprecated] API Specification'),
		name: 'api-spec-cn',
		//flag: 'new',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/api-spec-cn.md')
	}, {
		label: drTranslate('i18n'),
		name: 'i18n',
		//flag: 'new',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/i18n.md')
	}, {
		label: drTranslate('[Deprecated] How does it work'),
		name: 'how-does-it-work',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/how-does-it-work.md')
	}, {
		label: drTranslate('Server side template: Swig'),
		name: 'swig-template',
		//flag: 'new',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/swig-template.md')
	}, {
		label: drTranslate('Unit Test'),
		name: 'test',
		flag: '',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/test.md')
	}, {
		label: drTranslate('End-to-end Test'),
		name: 'e2etest',
		//flag: 'new',
		url: require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./docs/e2etest.md')
	}
];

var nameMap = {};

menuList = _.reduce(menuList, function(menuList, menu) {
	if (!menu.icon)
		menu.icon = 'fa-file-text';
	nameMap[menu.name] = menu;
	return menuList;
}, menuList);

module.exports = {
	list: menuList,
	map: nameMap
};
