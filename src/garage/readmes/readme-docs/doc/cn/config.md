全局配置文件
------------
### 项目目录结构和配置文件的位置
```
<project-root>
	├── dist/
	├── recipes/
	├── src/
	├── .git/
	├── e2etest/
	├── node_modules/
	|      └── web-fun-house/
	|              └── config.yaml
	├── .gitignore
	├── README.md
	├── app.js
	├── browserify-inject.js
	├── inject.js
	├── log4js.json
	├── ...
	├── package.json
	├── config.local.yaml
	└── config.yaml
```

`node_modules/web-fun-house/config.yaml` 是默认完整的配置文件。
config.yaml 和 config.local.yaml 是当前项目的全局配置文件.

#### 配置内容加载和覆盖顺序:

1. 读取 node_modules/web-fun-house/config.yaml
2. 读取 config.yaml, 覆盖已读取的同名的属性
3. 读取 config.local.yaml, 覆盖已读取的同名的属性

config.local.yaml 应该被放入.gitignore, 不作为生产环境的配置内容，例如`devMode: true`之类的配置项都写入config.local.yaml 以方便本地开发调试。

可以配置的属性很多，具体说明请看[github上的完整配置文件](https://github.com/dr-web-house/web-fun-house/blob/master/config.yaml)，例如:
- 和开发相关的
	- destDir： 	临时文件和静态文件目录
	- staticDir： 打包后的静态文件目录
	- devMode：开发者模式，为true时会取消uglify，revision bundle文件, assets文件copy等生产环境的打包或运行功能，加速本地开发
	- bundlePerPackage： 每个package单独打包bundle，不合并package，频繁修改源码时加速编译打包速度

- 和部署、bundle、node server相关的
	- staticAssetsURL: views, css，js里静态资源引用的URL domain前缀
	- serverURL:
	- port
	- sslPort
	- cacheControlMaxAge
	- packageScopes
	- locales
	- nodeRoutePath
	- packageContextPathMapping
	- entryPageMapping
	- vendorBundleMap：设置第三方package的bundle，或者是用来覆盖组件package.json中bundle配置，重新分配bundle配置

### 添加自定义的全局配置属性
建议添加自定义的属性时，尽量以package name作为顶级属性名，防止和其他属性名冲突
```yaml
@dr/packageA: # @dr/packageA is the package name
	propertyX: 1
```
读取配置时
```js
var value = api.config()[api.packageName].propertyX;
// Or
value = api.config.get([api.packageName, 'propertyX']);
```

### 用API获取配置内容
config API source code: [lib/config.js](https://github.com/dr-web-house/web-fun-house/blob/master/lib/config.js)
#### api.config()
会返回配置属性的object<{string}, {*}>
e.g.
```js
var api = require(`__api`);
if (api.config().devMode) {
	...
}
```
#### api.config.get(path, [defaultValue])
返回具体某个属性，或子属性的值，内部调用了`lodash` `.get(configObj, path, defaultValue)`
```js
api.config.get(['gulp', 'watchTimeout'])
```
等同于`api.config().gulp.watchTimeout` 但防止了某个子属性undefined的error

#### api.config.set(path, value)
动态修改全局配置(参数同`lodash`的`_.set(configObj, path, value)`)
- path (Array|string): The path of the property to set.
- value (*): The value to set.
```js
	api.config.set('gulp.watchTimeout', 1000);
```
等同于
`api.config().gulp.watchTimeout = 1000`

#### api.config.resolve(pathPropName, path...)
对于值是文件路径的属性, 返回绝对路径`fs.resolve(rootPath, api.config.get(pathPropName), path...)`
例如配置:
```yaml
e2etestHelper:
    selenium:
        driverPath: 'chrome-driver/linux64'
```
获取绝对路径
```js
var absolutePath = api.config.resolve('e2etestHelper.selenium.driverPath', 'linux64', 'chromedriver');
// "/Users/liujing/projectA/chrome-driver/linux64/chromedriver"
//
```

#### api.config().rootPath
获取当前项目的根目录绝对路径
