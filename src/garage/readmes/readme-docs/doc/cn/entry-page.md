入口页面
----------
### Entry package
指package.json中配置了"dr.entryView"或"dr.entryPage"属性的package。
这类package是浏览器访问的入口，是`gulp compile`依赖分析的起始点。
e.g.
```json
{
	...
	"browser": "browser.js",
	"dr": {
		"bundle": "somebundle",
		"entryPage": "views/index.html"
	}
}
```
引用其他package内的文件时用特殊前缀`npm://`, `npm://<package name>/<page path>`


#### 支持多个入口页面
Package.json 里的`entryPage`, `entryView` 可以是Array类型

#### 服务器渲染的入口页面

支持Express + Swig 手工插入 CSS, Javascript 依赖
用API 插入`<script>` `<link>` Tag

e.g. <package-sample>/views/body.html
```html
<!doctype html>
<html>
<head>
	<title>Entry page</title>
	{= api.entryStyleHtml('views/body.html') =}
</head>
<body>
	{= api.entryJsHtml('views/body.html') =}
</body>
```

<package-sample>/server.js
```js
var api = require('__api');

exports.activate = function() {
	api.router().get('/', (req, res) => {
		res.render('views/body.html', {api: api});
	});
};

```

| API Name | |
| - | -
| .entryJsHtml(entryViewPath) | 返回`<script>`代码片段
| .entryStyleHtml(entryViewPath) | 返回`<link ref="stylesheet">`代码片段
| .entryJsHtmlAsync(entryViewPath) | 返回Promise
| .entryStyleHtmlAsync(entryViewPath) | 返回Promise
| .entryJsHtmlFile(entryViewPath) | 返回保存有`<script>`代码片段的dist文件路径
| .entryStyleHtmlFile(entryViewPath) | 返回保存有`<link>`代码片段的dist文件路径


#### 编译的入口页面模板

### 页面文件插入依赖bundle
#### 自动插入


### Assets URL 自动替换
`assets://[package]/resourcePath`
