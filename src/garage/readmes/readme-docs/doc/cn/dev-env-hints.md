gulp常用命令和开发环境配置
==========
- Node version >= 4.2.0

- 安装本地Sinopia的建议不要使用太高版本的node.

- 本地配置修改config.local.yaml, 配置config.yaml用于生产环境

	```yaml
	# enable devMode to denote default builder tool do not uglify JS bundles
	devMode: true
	# During developing, you can set this to `true` to make every package to a single bundle
	bundlePerPackage: true
	# set max-age property of the Cache-Control header in `ms` format, see https://github.com/expressjs/serve-static
	# unit convention reference to github.com/guille/ms.js
	cacheControlMaxAge: 0

	# packageContextPathMapping:
	```

### Gulp 常用

- #### gulp build

	干净新环境和生产部署，npm install 后执行：
	gulp build

	gulp build实际是依次执行了
	`install-recipe`，`link`, `compile`

- #### gulp clean
	当有pacakge改名或者删除后，必须执行

	- 删除`/dist`目录，其实是删除对应默认config.yaml中配置的`destDir`, `staticDir`的目录

	```yaml
	destDir: dist
	staticDir: dist/static
	```
	- 删除`node_modules/@dr`, `node_modules/@dr-core`, 其实是对应默认config.yaml中配置的
	```yaml
	packageScopes:
	  - dr
	  - dr-core
	```
	- 修改所有`recipeSrcMapping`中对应的recipe目录下package.json, `dependencies` value清空为`{}`
- ### gulp link
	当新建npm package后，需要执行

	会自动更新所有source code对应的recipe目录package.json `dependencies`属性，简历node_modules/@dr目录下所有对应source code的连接文件

- ### gulp install-recipe
	新环境需要执行，npm install和recpie中加入其他team贡献的package后，需要执行。

	功能是对所有的recipe和平台默认recipe自动执行`npm install`，因为有些package对第三方有依赖，需要npm install来确保那些第三方library也被install到node_modules目录下

- ### gulp compile
	只有所有builder package, 编译browser package到dist/static目录下的bundle文件中

	`-p`可以指定只编译某些package, 加快开发编译速度
	```
	gulp compile -p <package-short-name>  -p <package-short-name>
	```

- ### gulp watch
	修改js, less, html, json等文件后，自动编译browser package,浏览器需要手工刷新，对修改node js代码无效

	`-p`可以指定只编译某些package, 可能节省些资源
	```
	gulp watch  -p <package-short-name>  -p <package-short-name>
	```
