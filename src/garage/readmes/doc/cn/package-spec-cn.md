Package.json Specification
===========

例子
```json
{
  "name": "@dr/doc-home",
  "version": "0.0.1",
  "description": "Home page",
  "browser": "browser/js/index.js",
  "main": "server/server.js",
  "style": "browser/style/main.less",
  "transforms": [ "@dr/parcelify-module-resolver"],
  "dr": {
	  "bundle": "home",
	  "entryPage": "index.html"
  },
  "author": "LJ"
}
```
Package.json的一些特殊属性说明

| 属性 | 说明
| -- | --
| `main` | Node Server端主Javascript文件
| `browser` | 浏览器端主Javascript文件
| `style` | 主LESS文件
| `transforms` | 目前只有一个值`["@dr/parcelify-module-resolver"]`
| `dr.bundle` (`dr.chunk`) | 合并打包属浏览器端JS, CSS文件时应该被归类于的bundle文件，多个package可以被归类到一个bundle下，以提高下载速度
| `dr.entryPage` | 入口主静态页面，`gulp compile`时会自动copy到dist/static目录下，自动inject所依赖的JS, CSS bundle
| `dr.entryView` | 类似`dr.entryPage`, 入口的server端render主页面, `gulp compile`时会自动copy到dist/server目录下, 用`api.getCompiledViewPath(relativePath)`可以获得compiled absolute path.

e.g.

```javascript
	activate: function(api) {
		api.router().get('/', function(req, res) {
			res.render(api.getCompiledViewPath('index.html'),
				{contextPath: api.contextPath});
		});
```
| 属性 | 说明
| -- | --
| `dr.browserifyNoParse` | 通知`gulp compile`时browserify不要parse某些js file，比如第三方library, 提高编译速度。

e.g.
```json
	"dr": {
		"bundle": "labjs",
	 	"browserifyNoParse": ["./LAB.src.js"],
	 	"noLint": true
	},
```
| 属性 | 说明
| -- | --
| `dr.noLint` | `gulp lint`不会对当前package check code style
| `dr.type` | 当value是"core"是，平台node server启动时会先加载当前的package，执行module.exports.activate(), 这样这个package 就是API provider, 可以用于monkey patch 新的属性或方法到api对象。
