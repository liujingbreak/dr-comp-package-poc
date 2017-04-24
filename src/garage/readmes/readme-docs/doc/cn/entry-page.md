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

#### 改变默认的入口页面访问路径
通过修改config.yaml, config.local.yaml 可以改变默认的入口页面访问路径，
默认的entry page 的固定输出目录是`dist/static/<package-short-name>/<entry-page-path>`
现在这个`<package-short-name>` 可以配置成另一个路径或者是root '/'
> `outputPath`对 server 渲染的entryView 不起作用，`packageContextPathMapping`是用来配置server端router和entryView的路径的唯一配置项

```yaml
entryPageMapping:
    # For static browser entry pages, the default entry page is compiled to
    #   dist/static/<package-short-name>/<entry-page-path>
    # so for example when you access page with browser, the URL is like
    #  "http://<host>:<port>/<package-short-name>/<replative-page-path>/index.html"
    #
    # If you want to change the URL to another folder like "http://<host>:<port>/<another-path>/<replative-page-path>/index.html",
    # do add a key-value pair <package-short/full-name>: <new-folder-path> like,
    #   package-A: /
    #   package-B: /entriesB
    #   package-C: entriesC
    # It doesn't matter whether the "value" part startsWith or endsWith slash "/",
    # but if the value is only a slash "/", it means the root folder "dist/static"

```


#### 服务器渲染的入口页面

支持Express + Swig 手工插入 CSS, Javascript 依赖
用API 插入`<script>` `<link>` Tag

e.g. <package-sample>/views/body.html
```html
<!doctype html>
<html>
<head>
	<title>Entry page</title>
	{= entryStyleHtml() =}
</head>
<body>
	{= entryJsHtml() =}
</body>
```

<package-sample>/server.js
```js
var api = require('__api');

exports.activate = function() {
	api.router().get('/', (req, res) => {
		res.render('views/body.html', {
			entryStyleHtml: function() {
				return api.entryStyleHtml('views/body.html');
			},
			entryJsHtml: function() {
				return api.entryJsHtml('views/body.html');
			}
		});
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

##### 注意：
 由于Swig `autoescape` default value 是true（[Swig variables](http://paularmstrong.github.io/swig/docs/#variables)）, 所以你不可以使用模板变量，必须使用Function。
 比如, 你**不可以**：
 ```html
 <!doctype html>
 <html>
 <head>
 	<title>Entry page</title>
 	{= entryStyleHtml =} <!-- Not working -->
 </head>
 <body>
 	{= entryJsHtml =} <!-- Not working -->
 </body>
 ```

 ```js
 exports.activate = function() {
 	api.router().get('/', (req, res) => {
 		res.render('views/body.html', {
 			entryStyleHtml: api.entryStyleHtml('views/body.html'),
 			entryJsHtml: api.entryJsHtml('views/body.html')
 		});
 	});
 };
 ```

#### 编译的入口页面模板

### 页面文件插入依赖bundle
#### 自动插入


### Assets URL 自动替换
`assets://package-name/resourcePath`
