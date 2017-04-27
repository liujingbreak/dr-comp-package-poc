# 扩展Webpack配置

> 关于如何扩展Webpack的配置, 添加loader或plugin.
内部使用了Webpack2, 请查看Webpack2的文档, 确保兼容

## 添加自定义的Loader
如果是小范围使用的loader, 不需要修改webpack config, 只需要添加loader JS文件在组件中目录中
e.g. my-loader.js
```js
var api = require('__api');
var log = require('log4js').getLogger(api.packageName + '.my-loader');
var lu = require('loader-utils');
var cheerio = require('cheerio');

module.exports = function(content) {
	var callback = this.async();
	loadAsync(content, this)
	.then(result => callback(null, result))
	.catch(err => {
		log.error(err);
		callback(err);
	});
};

function loadAsync(content, loader) {
	var $ = cheerio.load(content, {decodeEntities: false});
	$('h2').each(function(idx) {
		var el = $(this);
		el.html('hacked!');
	});
	return Promise.resolve($.html());
}
```
### 使用自定义的Loader
假如组件名为"@dr/my-component", 客户端JS代码:
```js
# output a html file as static assets
require('!lib/dr-file-loader!@dr/my-component/my-loader!lib/html-loader!./some-html');

# bundle a html file as a stringified JS exports object
console.log(require('!html-loader!@dr/my-component/my-loader!lib/html-loader!./some-html'));
```
> Example中用到的 **lib/dr-file-loader**, **lib/html-loader**都是@dr-core/webpack2-builder内部loader
[https://github.com/dr-web-house/web-fun-house/tree/wip/src/internal/compile/webpack2-builder/lib](https://github.com/dr-web-house/web-fun-house/tree/wip/src/internal/compile/webpack2-builder/lib)



## 用扩展组件在runtime修改默认webpack config

### 先要编写一个类型为"builder"的打包扩展组件
package.json
```json
{
	"name": "@dr/my-component",
	...
	"main": "server.js",
	"dr": {
		"type": ["builder"],
		...
	}
}
```
需要有"main", "dr.type"
如果你要添加plugin或者要增加默认Loader, 两种途径
- 贡献代码到@dr-core/webpack2-builder
- 添加新的类型为"builder"的打包扩展组件, runtime修改config

在main JS文件里添加获取webpack config的代码:
```js
var _ = require('lodash');
require('@dr-core/webpack2-builder').tapable.plugin('webpackConfig', function(webpackConfig, cb) {
	// do something to webpackConfig
	var htmlRule = _.find(webpackConfig.module.rules, rule => (rule.test instanceof RegExp) && rule.test.toString() === '/\\.html$/');
	htmlRule.use.append({loader: '@dr/my-component/my-loader'});

	cb(null, webpackConfig);
	// or encounter errors
	// cb(error);
});
```
`cb(null, webpackConfig);` 回传扩展过的config对象

默认的 webpack config: [https://github.com/dr-web-house/web-fun-house/blob/wip/src/internal/compile/webpack2-builder/webpack.config.js](https://github.com/dr-web-house/web-fun-house/blob/wip/src/internal/compile/webpack2-builder/webpack.config.js)



