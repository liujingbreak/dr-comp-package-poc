gulp常用命令和开发环境配置
==========
_2016-3-28 更新_


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
	`install-recipe`，`compile`

- #### gulp clean
	当有pacakge改名或者删除后，最好执行

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

	#### gulp clean:dist
	>一般本地开发不必删除node_modules下一些dependency时常用这个够了。

	只删除`/dist`目录，其实是删除对应默认config.yaml中配置的`destDir`, `staticDir`的目录


- ### ~~gulp link~~
	> `gulp compile` 会自动执行这个命令

	~~当新建npm package后，需要执行~~

	~~会自动更新所有source code对应的recipe目录package.json `dependencies`属性，简历node_modules/@dr目录下所有对应source code的连接文件~~

- ### gulp install-recipe
	> 如果执行了gulp clean 后，要恢复重新安装被删除的依赖package时使用
	新环境需要执行，npm install和recpie中加入其他team贡献的package后，需要执行。

	功能是对所有的recipe和平台默认recipe自动执行`npm install`，因为有些package对第三方有依赖，需要npm install来确保那些第三方library也被install到node_modules目录下, 另外NPM 2.x install后的目录结构是层级式，安装recipe后，组件package会出现在recipe-xxx/node_modules目录下，这个命令会flatten这个结构，把依赖的package移到当前node_modules目录下。(NPM 3.x不存在这个麻烦).

- ### gulp compile
	link package.json到node_modules, 调整NPM 2.x install后的目录结构等，
	编译browser package到dist/static目录下的bundle文件中

	`-p`可以指定只编译某些package, 加快开发编译速度
	```
	gulp compile -p <package-short-name>  -p <package-short-name> -b <bundle-name>
	```

	#### gulp compile:dev
	比`gulp compile`快速, 只负责编译bundle

- ### gulp watch
	修改js, less, html, json等文件后，自动编译browser package,浏览器需要手工刷新，对修改node js代码无效

	`-p`可以指定只编译某些package, 可能节省些资源
	```
	gulp watch  -p <package-short-name>  -p <package-short-name>
	```
- ### gulp check-deps
	列出所有组件package的dependencies, 方便查看组件的第三方依赖有没有版本不一致

- ### gulp build-prod
	gulp build，但是忽略config.local.yaml配置，用于production环境的build: uglify, revisioning bundles等

- ### gulp bump
	所有source code 和响应recipe的package.json build version number + 1, `gulp public`前使用\
	可选参数:\
	`-v major|minor|patch|prerelease`
	> 当`gulp bump -v prerelease`时, 生成的package.json version 是x.x.x-0开始的prerelease号，publish到Sinopia不会发送提醒email

- ### gulp publish
	npm publish所有package and recipe, not including installed packages.

- ### gulp unpublish
	npm unpublish, 撤回最近发布的源码里的所有package的当前版本 (是指开发环境里package.json version里的版本，不是npm registry的最新版本)
