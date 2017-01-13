Updates
=======
2017-1-13
- package.json property "dr.entryPage", "dr.entryView" supports `glob` format for pointing multiple path
e.g. `*.html`, `views/*.html`
```json
"dr": {
	"entryPage": ["*.html", "views/about.html"]
}
```

**web-fun-house** 0.9.1
- new environment variable `DR_CONFIG_FILE` [配置文档](config.md)
- package.json 新配置属性
`"dr.browserSideConfigProp"` [配置文档](config.md)

### 2016-12-14
**web-fun-house 0.8.8**
- 支持新命令行option`gulp compile -c <config.xxx.yaml>`, `node app -c <config.xxx.yaml>`
- 默认 config.yaml `cacheControlMaxAge` 根据文件扩展名分别配置了不同的值
```yaml
cacheControlMaxAge:
    js: '365 days'
    css: '365 days'
    less: '365 days'
    html: 0
    png: '365 days'
    jpg: '365 days'
    gif: '365 days'
    svg: '365 days'
    eot: '365 days'
    ttf: '365 days'
    woff: '365 days'
    woff2: '365 days'
```
### 2016-12-6
**web-fun-house 0.8.0**
- 优化了`gulp watch`，(gulp.watch is replaced with chokidar) 
新增和删除代码文件都会触发自动编译, package.json "dr.noWatch" 可以是{string|array}glob表达式

- 在开发模式`devMode` true时，
正式开发时可以用`gulp watch`代替 `gulp compile`， Node server内置了的tiny-lr，任何改动都可以会触发自动编译和自动页面刷新，方便浏览器端的开发。
注意livereload配置端口如果被占用冲突，需要修改config.local.yaml
```
livereload:
	port: 135729
```
> **livereload** 目前对改动Node端JS没有自动重启Server效果。
**web-fun-house 0.7.3 release**
- New config.yaml property,
```yaml
colorfulConsole: false
``` 
同样效果设置环境变量 CHALK_ENABLED=false
可以禁止在Jenkins等远程build环境中console log输出特殊的色彩字符。
- 对Split loading `require.ensure()`修复一些`gulp watch`时的bug
- 升级部分第三方依赖
- 去掉了对旧i18n方式支持的代码

**web-fun-house 0.7.2 release**
- Bug fixes

**web-fun-house 0.7.1 release**
- **Swig** is out of maintainance, replace Swig with [swig-templates](https://www.npmjs.com/package/swig-templates)
### 2016-11-22
**web-fun-house 0.7.0 release**
- i18n重新设计，采用更简单的方案，gulp编译打包时替换可翻译文字到不同的语言
- @dr/angularjs has been upgraded to AngularJS 1.5.8
### 2016-11-14
#### Breaking change
package.json中的dr.builderPriority, dr.serverPriority 数字越大，越优先， 原来是越小越优先

### 2016-11-8 web-fun-house v0.6.4
环境变量 `WFH_NODE_PATH` 可以以用于对Node module search path的扩展， 和NodeJs 的系统变量`NODE_PATH`类似但是又不同：NODE_PATH是添加在搜索path列表的末尾，优先级最低，而`WFH_NODE_PATH`会被插入在 `<working-directory>/node_modules`之前, 优先级很高

### 2016-11-4
- New browser side API function
`.urlSearchParam(searchString)` which parses `window.location.search` to a hash object.
- @dr/translate-generator brought handy Angular directives to display locale text in HTML
### 2016-9-27
- 部署到CDN和引用CDN资源，新config.yaml配置属性  [externalBundleMap](/#/doc/cdn-bundle.md)

### 2016-8-31
- #### 新配置属性 config.yaml
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
默认的entry page 的固定路径是`dist/static/<package-short-name>/<entry-page-path>`
现在这个`<package-short-name>` 可以配置成另一个路径或者是root '/'

- #### New builder and server side package API

`api.entryPageUrl: function(packageName, relativePagePath)`
返回entryPage的访问URL


### 2016-8-19
- No longer supporting writing Assets URL syntax without specifying exact package name like `assets:///`,
it is problematic when an external package file is "imported" or "included" via LESS or Swig into another
package, the ommitted `packageName` is acturally resolved to importer package name instead of importee package.

### 2016-8-15
- Support NPM v3.10, folder `dist/links` caches symbolic links to all the packages in `src` folder during build process.
- `gulp ls` will show a list of all components of current project, including Browser packages, node server and compiler packages.
### 2016-7-8
[Server side rendering entry page API](/#/doc/entry-page.md)


### 2016-7-6
Support referencing package name from Swig template tags:
```
{% include "npm://packageA/views/template"}
{% import "npm://packageA/views/common" as common %}
```
任何Express res.render(view) 或者是预编译@dr/template-builder的template文件都支持`npm://`

并且可以通过修改 injector.js, 依赖注入式的替换package name:
[swig-package-tmpl-loader](https://www.npmjs.com/package/swig-package-tmpl-loader#injection)


### 2016-6-24
新gulp命令, 可以列出所有会被运行的package, 包括installed package
```
gulp ls
```
当前有多少package和运行优先级一目了然

### 2016-6-23
为升级主站，增加灵活性，新加了express-app API
- api.swig
- api.expressAppSet({function(app, express)} callback)

### 2016-6-13
- browser和NodeJS统一的API获取方式：`require('__api')`
- 新的解耦方式，新增两个配置JS文件，用于注入依赖或替换依赖
	inject.js, browserify-inject.js。
	采用了[require-injector](https://www.npmjs.com/package/require-injector)
- 新增了light-lodash, minify后core bundle的gzip size减少 6k
- 集成测试命令 gulp e2e --server 参数可以自动启动server
- web-fun-house命令可以`npm install -g web-fun-house-cli`


### 2016-5-31
### Support Webpack like **Code Splitting**
Defining a split point
```js
require.ensure(dependencies, callback)
```
All JS, HTML and CSS files which are within require() dependency chain can be split downloaded.

### 2016-5-24
**Breaking change!**
- 所有自启动的Node runtime package， package.json文件需要标示`"dr"."type"`为 `"server"`

- 支持多个`"dr"."type"`, 可以是Array型或String型
	```json
	"dr": {
		"type": ["builder", "server", "core"]
	}
	```
- 支持基于selenium-webdriver的end-to-end test


### 2016-4-29
1. Node API new function\
	`.joinContextPath(path)`
2. config.yaml 增加了一个property `enableSourceMaps: false`

### 2016-4-23
1. package.json 废弃`dr.priority`, 分为支持`"dr"."builderPriority"` 和 `dr.serverPriority`, `before|after package-name`的形式。
2. 更完整的i18n, /i18n目录下的locale js文件可以require()另一个package, 可以有stylesheets，和其他普通package 一样复杂的resource。从而可以支持复杂的本地化，
> 不推荐为某个locale编写太复杂的定制,比如重新设计style。那意味着并不是i18n。

### 2016-4-14
1. `gulp test` 命令
	```
	gulp test [-p <package name>] [-f <spec file>] [--spec <spec name filter>]
	```

	[如何测试](/doc-home/index.html#/doc/test.md)
2. **translate-generator** 工具
	```
	gulp compile --translate [-p <package-name>]
	```
	扫描`.js`, `.html` 文件，自动生成可翻译的文件
	```
		<package-dir>/i18n/
			├─ index.js
			├─ messages-en.yaml
			├─ messages-zh.yaml
			└─ ... other locale files in form of messages-{locale}.yaml
	```
	详细扫描的规则 [i18n文档](/doc-home/index.html#/doc/i18n.md)

### 2016-4-6
- 更新了 [i18n文档](/doc-home/index.html#/doc/i18n.md)
- i18n support
	新的browser side API
	| Name | description
	| -- | --
	| .loadLocaleBundles(language, callback) | LABjs loads locale bundles to current page
	| .loadPrefLocaleBundles(callback) | LABjs loads locale bundles based on browser prefered language, language choosing logic is in the order of: `navigator.languages[0], navigator.language, navigator.browserLanguage, navigator.systemLanguage, navigator.userLanguage, navigator.languages[1] ...`
	| .getPrefLanguage() | `__api.loadPrefLocaleBundles()` 调用此方法
	| `.isLocaleBundleLoaded()` | return true 如果locale bundle已经加载，可以安全调用的require('xxx/i18n')了
	| `.extend(obj)` | 扩展 API prototype `__api.__proto__`,  `__api.constructor.prototype`
- 很简单的i18n example！查看\
	[github.com/dr-web-house/web-fun-house/tree/master/src/examples/example-i18n](https://github.com/dr-web-house/web-fun-house/tree/master/src/examples/example-i18n)

- 支持AngularJS i18n

- 增加了Browserify **yamlify** transform

	```javascript
	var constants = require('./constants.yaml');
	```
- Express server 增加了gzip middleware
- 支持了browser JS require() 文件名特殊标记`{locale}`
	```
	require('./xxx-{locale}xxx');
	```
	```
	gulp compile --locale en
	```

### 2016-3-31
- Static Assets URL

	所有被browser javascript `require()`的 `.html`文件， 包括entryPage, entryView文件 会在gulp compile时自动替换 `assets:///<file-path>` 或者 `assets://<package-name>/<file-path>` 的引用。
	这样就可以直接在html中添加 `<img src="assets:///photo.jpg">` 而不需要通过angularJS之类的web framework来处理正确的URL了。

### 2016-3-30
- Static Assets URL

	引用当前package内的assets文件路径，可以省略package name,
	比如， 原来是 `assets://@dr/doc-home/images/bg.jpg`, 可以省略为
	`assets:///images/bg.jpg`
	> 注意: 省略package name时，`assets:///` 的路径是有三个slash`/`开始

	修改了文档[Introduction](http://dr-web-house.github.io/#/doc/readme-cn.md)


### 2016-3-29
- 更新文档 [Daily Work: 安装平台 & 开发组建](/#/doc/run-platform-as-tool-cn.md)
- 新命令
```
./node_modules/.bin/web-fun-house update
```
用于`npm install web-fun-house`升级完平台版本后，`update`不会复制example代码, 检查gulp版本和其他依赖.

### 2016-3-28

-	Package.json 支持 `dr.entryPage` 和 `dr.entryView` 值可以是引用其他package内的文件，以更好支持对其他package资源的reuse.`npm://<package-name>/<path>`

-	`gulp compile` 出错会beep

-	publish package时， 当package.json version 符合beta, alpha 或者 x.x.x-xx prerelease的格式， Sinopia NPM server 不会发邮件

-	`gulp bump` 支持 -v <major|minor|patch|prerelease>可选参数

### 2016-3-25

-	每个package支持多个Entry页面，\\ package.json内的 "`dr`"."`entryView`" 或"`dr`"."`entryPage`"可以是array类型

-	更新Introduction文档\\ 增加静态资源的描述

	#### Static Assets URL

	静态资源文件放入`packageRootDir/assets` 目录, 用`assets://<package-name>` 引用

	```less
	.some-selector {
	    background-image: url(assests://@dr/my-package/background.jpg);
	}
	.some-equivalent {
	    background-image: url("assests://@dr/my-package/background.jpg");
	    background-image: url('assests://@dr/my-package/background.jpg');
	}
	```
