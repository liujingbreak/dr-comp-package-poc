API 详细说明
============

API 被用来提供最常用的功能
- API instance是一个javascript对象。
- 每个package组件运行时都可以获取对应它的API instance.
- API instance包含了当前package的基本信息
- API instance像一个service
- API可以是一个查找service的name space.
- API的属性和方法是可以动态修改的。

Package的合作方式是互相`require()`对方，调用对方来完成一个复杂的功能, 对于有些核心的package，比如express server之类的，提供API更方便，也降低耦合。

### How API works

![images/API-Diagram.png](images/API-Diagram.png)

API 像一个service对象， Node平台会在启动时为每个package创建一个API instance, 里面包含一些当前package的基本信息和访问全局配置文件的方法, event bus等，API provider package 会最先加载，在运行时修改API prototype来增加新的API属性和方法(这个过程称为**monkey patch**)，其他package会在之后加载，就可以调用API stance的新方法. 浏览器端运行内也是类似步骤.

#### 获取API instance
- 新的获取方式是`require('__api')`， 无论是browser 还是Node 的JS里面都可以用这种方式获取API
> 每个package在运行时只有一个对应的API instance, 就是说同一个package里不同JS文件访问的是同一个API instance, 他们可以利用api传递信息，但是API prototype是全局的，会影响到所有的package访问到的API instance

##### 旧的方式
- Node side, API 对象是在main JS file `module.exports.activate(api)` 时被传入的

```javascript
exports.activate = function(api) {
	console.log(api.packageName);
	api.router().get(function(req, res) {
		res.render('/template.html');
	});
};

```
- 浏览器端JS 获取API比较简单, 在任何JS文件里可以访问全局变量`__api` (`__api`其实每个JS file的局部变量)， 类似`__filename`, `__dirname`

```javascript
console.log(__api.packageName);
console.log(__api.contextPath);
console.log(__api.assetsUrl('some-picture.jpg'));
```
### API 属性和方法
- #### Node

| Name | description
| -- | --
| .packageName | 定义在package.json 里的name. e.g. `@dr/doc-home`
| .packageShortName | 当前package name 不包含scope部分 e.g. `doc-home`
| .packageInstance | packageInstance 对象,一些更复杂的当前package信息
| .contextPath | 当前package Node 端运行作为Express router时的，http 访问根路径， 是根据config.yaml里面`nodeRoutePath + packageContextPathMapping`配置计算得，默认是`/<package short name>`, 比如`/doc-home`
| .joinContextPath(path) | return `contextPath + '/' + path`， eliminate double ‘`//`’ if contextPath endsWith '`/`' or path begins with '`/`'
| .eventBus | API prototype的属性, EventEmitter对象
| .packageUtils | lib/packageMgr/packageUtils.js 查找其他package的工具
| `.config()` | API prototype的属性, 获取config.yaml配置
| `.assetsUrl(packageName, path)` | 获取packageName对应的静态资源/assets目录下的文件的浏览器访问路径, `packageName` 为可选参数, 默认是当前package
| `entryPageUrl(packageName, relativePagePath)` | 返回指定package的某个entryPage URL
| `.isBrowser()` | false
| `.isNode()` | true

- #### 浏览器

| Name | description
| -- | --
| .packageName | 定义在package.json 里的name. e.g. `@dr/doc-home`
| .packageShortName | 当前package name 不包含scope部分 e.g. `doc-home`
| .contextPath | 当前package Node 端运行作为Express router时的，http 访问根路径， 是根据config.yaml里面`nodeRoutePath + packageContextPathMapping`配置计算得，默认是`/<package short name>`, 比如`/doc-home`
| .eventBus | 一个singleton 的EventEmitter对象
| .bundle | 当前package所属于的bundle名称
| `.config()` | 获取config.yaml配置， 但是浏览器端只有部分config属性可读:  `staticAssetsURL`, `serverURL`, `packageContextPathMapping`
| `.assetsUrl(packageName, path)` | 获取packageName对应的静态资源/assets目录下的文件的浏览器访问路径, `packageName` 为可选参数, 默认是当前package
| `.urlSearchParam(searchString)` | parses window.location.search and returns a hash object
| `.getPrefLanguage()` | Get browser prefered language, language choosing logic is in the order of: `navigator.languages[0], navigator.language, navigator.browserLanguage, navigator.systemLanguage, navigator.userLanguage, navigator.languages[1] ...`
| `.reloadToLocale(lang)` | return true if current page will be reloaded to locale based URL of `lang`
| `.extend(obj)` | 扩展 API prototype `__api.__proto__`,  `__api.constructor.prototype`
| `.isBrowser()` | true
| `.isNode()` | false
| **Deprecated** ~~`.loadLocaleBundles(language, callback)`~~ | ~~LABjs loads locale bundles to current page~~
| **Deprecated** ~~`.loadPrefLocaleBundles(callback)`~~ | ~~LABjs loads locale bundles based on browser prefered language, language choosing logic is in the order of: `navigator.languages[0], navigator.language, navigator.browserLanguage, navigator.systemLanguage, navigator.userLanguage, navigator.languages[1] ...`~~
| **Deprecated** ~~`.isLocaleBundleLoaded()`~~ | returns true 如果locale bundle已经加载，可以安全调用的require('xxx/i18n')了


- #### Node compile-time
对于"dr.typ"为"builder"的编译工具类package, 可获得的api和Node server运行时那些package的api一样，只是多了两个有用的属性

| Name | description
| -- | --
| .argv | **[yargs](https://www.npmjs.com/package/yargs)**, Gulp compile命令带有的参数，比如`-p`, '-b'等
| .buildUtils | lib/gulp.buildUtils.js
| .packageInfo | monkey patched by `@dr-core/browserify-builder`
| .findBrowserPackageByPath(filePath) | monkey patched by `@dr-core/browserify-builder`, 返回package source code对应的package name
| `replaceAssetsUrl(str, sourceFile)` | Replace all text `assets://...` to exact URL string, `str` is the text content, `sourceFile` is absolute file path of that text content, replacement involves setting from "browser-injector.js", so you must provide `sourceFile` path as parameter. Return replaced content.
| `entryPageUrl(packageName, relativePagePath)` | 返回指定package的某个entryPage URL
| `getBuildLocale()` | Return current compilation locale name. It could be what you type `gulp compile --locale <locale>` with, or the default locale `locales[0]` which is configured in `config.yaml`
| `isDefaultLocale()` | true if current compilation locale is  same as `locales[0]` in config.yaml
| `localeBundleFolder()` | return '' for default locale, or 'en/' for any other locale e.g. "en"

### 一些内置API providers

##### @dr-core/express-app (src/core/express-app)
增加了设置expresso router功能的API‘’
Node API methods
| Name | Description
|-- | --
| .router() | return an Express Router object, e.g. `api.route().get(function(req, res) {});`
| .use() | Express use() method, to bind middleware
| .param() | Express param() method
| .express | Express instance, 这样你就可以使用一些特殊的middleware 比如express.static
| .expressAppSet(callback) | callback: function(app, express), 在express app初始化之前覆盖默认的设置，比如`app.set('view', ...)`
| .swig | express view engines: `require('swig')`, 如果需要对swig做特殊设置，比如添加filters之类

> 必须在module.exports.activate(api) function内调用

##### @dr-core/browserify-builder-api (src/compile/browserifyBuilderApi)

- Node API

| Name | Description
| -- | --
| `.getCompiledViewPath( packageRelativePath)` | 对于package.json里面"dr"."entryView" 配置的主入口server rendered template页面， `gulp compile`时会自动copy到dist/server目录下, 用api.getCompiledViewPath(relativePath)可以获得加工后的html文件路径, 用于express render

e.g.
假设
package 根目录下有一个index.html

```javascript
var api = require('__api');

exports.activate = function(){
	api.router().get('/', function(req, res) {
		res.render(api.getCompiledViewPath('index.html'),
			{greeting: 'Hellow world'});
	});
};

```

e.g. expressAppSet(callback)
```js
var api = require('__api');

exports.activate = function(){
 	api.expressAppSet((app, express) => {
 		app.set('trust proxy', true);
		app.set('views', Path.resolve(__dirname, 'web/views/'));
	});
};
```
