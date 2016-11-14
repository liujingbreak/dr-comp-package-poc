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
  "i18n": "i18n/resource-{locale}.json",
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
| `dr.bundle` (`dr.chunk`) | 合并打包属浏览器端JS, CSS文件时应该被归类于的bundle文件，多个package可以被归类到一个bundle下，以提高下载速度。**如果为`false` 或`undefined` 被视为是默认自动分配: 加入到依赖的package所在的bundle，如果被多个不同bundle中package依赖，就会被重复加入到每个依赖的bundle中**
| `dr.entryPage` | 可以是Array, 入口主静态页面，`gulp compile`时会自动copy到dist/static目录下，自动inject所依赖的JS, CSS bundle, 可以是package内相对路径，也可以是引用其他package内的文件`npm://<package-name>/<path>`，e.g. `npm://@dr/parent/browser/views/index.html`
| `dr.entryView` | 类似`dr.entryPage`, 可以是Array, 入口的server端render主页面, `gulp compile`时会自动copy到dist/server目录下, 用`api.getCompiledViewPath(relativePath)`可以获得compiled absolute path.
| `dr.assetsDir` | 存放静态资源的目录，package根目录下的相对路径, 默认为`assets`
| `dr.i18n` | 可选配置，默认就是`i18n`。i18n 文件所在路径，可以是带有{locale}变量的路径pattern，可以是某个代表i18n逻辑的主文件夹或文件，其他JS代码可以通过`require('packageName/i18n')`的方式获取i18n对象，i18n文件可以是`.json`, `.yaml`, `.js`
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
| `dr.type` | 当value是"core"是，平台node server启动时会先加载当前的package，执行module.exports.activate(), 这样这个package 就是API provider, 可以用于monkey patch 新的属性或方法到api对象。`dr.type` 还可以有其他的值，`server` 代表是Node service package; `builder` 代表是一个build tool, `gulp compile`会依次调用他们
| `dr.serverPriority` | number 或string, 可以用于package调用排序(调用主文件`exports.activate(api)`时的顺序)，lib/packageMgr/packagePriorityHelper.js负责处理priority排序, 缺省时默认为5000,数字越大越优先，支持Async，当exports.activate() 返回类型是Promise时，只有resolve了才会依次调用下一个package; 也可以是`before|after <package-name>`的string格式，比如'before @dr/my-package', 所有before, after相同package的priority会被视为可以同时，以Promise.all()的方式处理主文件的返回结果，然后调用下一个package。
| `dr.builderPriority` | 同 `dr.serverPriority`, 对于`dr.type`为`builder`时，调用 `exports.compile(api)`的顺序排序
| `dr.noLint` | `gulp lint`不会对当前package check code style
| `dr.noWatch` | `gulp watch` will skip current package
> 当有复杂的先后顺序时，也可以用api.eventBus eventEmitter来解决，dr.priority只是一个补充的方便的机制
