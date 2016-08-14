开发组件
============
> 建议安装全局的Gulp 命令行工具:
> ```
>	sudo npm install -g gulp-cli
> ```
> 如果你没有安装全局的Gulp 命令行工具也没有关系，以下文档所有提到 `gulp`命令的地方请替换使用`node_modules/.bin/gulp`
### 0. 安装全局命令行工具
```
npm install -g web-fun-house-cli
```
### 1. 安装平台

创建一个空目录，一定要`npm init`一个package.json文件
```
	project-dir/
		└─ package.json
```
执行
```shell

npm set registry http://npm.dianrong.com
# For user from Shanghai Office, you may also use http://npm501.dc.dianrong.com:4873
npm install --save web-fun-house
```
你的目录会是

```
project-dir/
	├─ node_modules
	│		├─ web-fun-house
	│		└─ .bin
	│		
	└─ package.json

```
### 2. 生成初始文件

执行命令
```
web-fun-house init
```
_**这命令2016-3-26 做了简化**，自动生成样板源码和安装平台默认组件_:
- 自动安装gulp
- 执行`gulp install-recipe`自动安装一些核心的功能组件, 例如
@dr-core/browserify-builder, @dr-core/express-server 等

你还需要手工添加适合你项目的 `.gitignore`, `.npmignore` 文件。

##### 查看当前有多少组件package
```shell
gulp ls
```
例如会显示
```
[16:59:52] -- Server Package list  --
[16:59:52] 1. @dr/environment                    activate priority: 0
[16:59:52] 2. @dr/http-server                    activate priority: 0
[16:59:52] 3. @dr-core/browserify-builder-api    activate priority: 5000
[16:59:52] 4. @dr-core/express-app               activate priority: 5000
[16:59:52] 5. @dr/doc-home                       activate priority: 5000
[16:59:52] 6. @dr/example-entry                  activate priority: 5000
[16:59:52] 7. @dr/example-node                   activate priority: 5000
[16:59:52] 8. @dr-core/assets-processer          activate priority: 99999
[16:59:52]
[16:59:52] -- Builder Package list  --
[16:59:52] 1. @dr-core/browserify-builder-api    compile priority: 0
[16:59:52] 2. @dr-core/assets-processer          compile priority: 2000
[16:59:52] 3. @dr/light-lodash                   compile priority: before @dr-core/browserify-builder
[16:59:52] 4. @dr/template-builder               compile priority: before @dr-core/browserify-builder
[16:59:52] 5. @dr/readme-docs                    compile priority: before @dr-core/browserify-builder
[16:59:52] 6. @dr-core/browserify-builder        compile priority: 3000
[16:59:52] 7. @dr/translate-generator            compile priority: 5000
```
### 3. 编译运行！
```shell
gulp compile

node app.js
```
浏览器访问

http://localhost:14334/example-entry

#### 4. 尝试安装更多的可用组件，比如文档主页

```
npm install @dr/garage-recipe
# no need to run 'gulp install-recipe' anymore
```
~~编辑 `config.yaml` or `config.local.yaml`, 修改`installedRecipes`属性~~

> 确保安装的recipe命名匹配config.yaml的配置
> ```yaml
> installedRecipes:
>    - node_modules/@dr/*-recipe
>    - node_modules/@dr/recipe-*
> ```

再次执行以下命令
```
gulp compile

node app.js
```
访问 [http://localhost:14334/example-entry](http://localhost:14334/example-entry)

#### 5. 安装他人贡献的组件
可以安装recipe的方式一次安装多个package: `npm install <recipe-name>`

也可以单独安装某个package: `npm install xxx`，再执行一次`gulp install-recipe` 确保第三方的依赖也安装正确~~

再次执行`gulp compile` 后就可以了。

> 也可以执行`gulp build`,
`gulp build` = `gulp install-recipe` + `gulp compile`

#### 6. 修改代码

修改example-entry or example-node目录下的源码后
```
gulp compile
gulp compile -p example-entry -p ...
```
可选参数`-p example-entry` 表示只编译package @dr/example-entry, 不用编译全部，可以加快编译速度

```
gulp watch
gulp watch -p <package-name> -p ...
```
监视代码更改情况，自动编译，浏览器需要手动刷新后看到更新效果，node的代码更改后无效，需要手工重启`node app.js`

```
gulp clean:dist
```
删除掉dist 和 dist/static目录, 一般切换devMode build干净的browser bundles需要执行一下

```
gulp clean
gulp install-recipe
```
会删除所有dist和node_modules下的私有package，包括核心组建,
恢复开发环境需要重新执行 `gulp install-recipe` 或者 `web-fun-house update` 来安装核心package, 其他package都需要手动npm install

#### 7. 从git repo clone全新的项目
由于新下载的项目通常会ignore node_modules目录，所以需要重新install web-fun-house和依赖
```
npm install web-fun-house
web-fun-house update
```
> `web-fun-house update`和`web-fun-house init`区别是后者会copy example目录, 所以已有的项目不需要再init，
> 执行`web-fun-house`查看帮助

#### 8. 升级
_平台本身和其他组建一定会一直有更新，当别的同学维护的package publish了新版本时，需要更新本地的package_
- 当有新版本web-fun-house发布后, 在项目根目录下再一次执行
	```
	npm install web-fun-house
	web-fun-house update
	```
- 更新某个recipe 或者单独更新某个package
	```
	npm install @dr/xxx
	```
好了，再次`gulp compile`吧！

#### 9. build Production版本
build一个uglified, revisioned, compressed，大块bundle的生产环境版本

```
gulp build-prod
```
这个命令会`gulp clean:dist` dist, dist/static目录，它不会读config.local.yaml的配置内容。
这就是生产环境的build过程，还记得config.local.yaml里那些关闭的设置吗。

```json
devMode: true
# During developing, you can set this to `true` to make every package toa single bundle
bundlePerPackage: true
cacheControlMaxAge: 0
```
当然你也可以直接删除config.local.yaml :)

#### 10. 手动发布package
通常这个可以由持续集成的server来自动完成，当然也可以在本地手工发布，
在此之前请不要忘记`gulp lint`和测试。

发布, 为了简单，通常可以所有的package一起发布
```
gulp publish
```
后悔刚刚发布所有package
```
gulp unpublish
```
更新patch版本再次发布, 会触发Sinopia邮件提醒
```
gulp bump
gulp publish
```
更新prerelease版本再次发布，不会触发Sinopia邮件提醒, 如果只是为悄悄的和基友调试，发布一个prerelease版本再合适不过了
```
gulp bump -v prerelease
gulp publish
```
记得将bump后的被自动修改的所有package.json文件提交`git commit -m 'bump version'`

##### 手动修改单个package的package.json version 并发布
你可以手动修改单个组件package的package.json，之后需要执行:

`gulp link` (同步recipe里面dependencies的版本)

**而且你还需要手工修改相应的recipe package.json version**
然后:
```
npm publish <package-directory-path>
npm publish <recipe-directory-path>
```
recipe必须一起被发布，不然如果其他team是通过recipe来更新一批组建时，无法获得最新的组件版本
