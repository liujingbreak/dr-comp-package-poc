依赖平台的开发方式
============

现在是时候用这个平台开发一个新Web app的时候了。

> 建议安装全局的Gulp 命令行工具:
> ```
>	sudo npm install -g gulp-cli
> ```
> 如果你没有安装全局的Gulp 命令行工具也没有关系，以下文档所有提到 `gulp`命令的地方请替换使用`node_modules/.bin/gulp`

### 1. 安装平台

创建一个空目录，一定要`npm init`一个package.json文件

```
	project-dir/
		└─ package.json
```
执行


```shell

npm set registry http://10.9.14.9:4873

npm install web-fun-house
```

你的目录会是

```
project-dir/
	├─ node_modules
	|		├─ web-fun-house
	|		└─ .bin
	|		
	└─ package.json

```
### 2. 生成初始文件

执行命令
```
node_modules/.bin/web-fun-house init
```
这命令做了简化，自动生成样板源码和安装平台默认组件:
- 自动安装gulp
- 自动安装一些核心的功能组件, 例如
@dr-core/browserify-builder, @dr-core/express-server 等


你可能还需要手工添加适合你项目的 `.gitignore`, `.npmignore` 文件。

### ~~3. 安装平台默认组件~~

这个步骤已不再需要，已经在`node_modules/.bin/web-fun-house init`中完成了。

### 4. 编译运行！
```shell
gulp compile

node app.js
```
浏览器访问

http://localhost:14334/example-entry

#### 5. 尝试安装更多的可用组件，比如文档主页

```
npm install @dr/garage-recipe

# no need to run 'gulp install-recipe' anymore
```
~~编辑 `config.yaml` or `config.local.yaml`, 修改`installedRecipes`属性~~

> 确保安装的recipe命名符合config.yaml的配置规范
> ```yaml
> installedRecipes:
>    - node_modules/@dr/*-recipe
>    - node_modules/@dr/recipe-*
> ```

执行以下命令，大功告成
```
gulp compile

node app.js
```
访问 [http://localhost:14334/example-entry](http://localhost:14334/example-entry)

#### 6. 安装他人贡献的组件
可以安装recipe的方式一次安装多个package: `npm install <recipe-name>`

也可以单独安装某个package: `npm install xxx`， ~~然后手工添加到某个recipe `pakcage.json`的属性 `dependencies`中, 再`gulp install-recipe` 确保第三方的依赖也安装正确~~

再次执行`gulp compile` 后就可以了。

#### 7. 修改代码

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
恢复开发环境需要重新执行 `gulp install-recipe` 或者 `node_modules/.bin/web-fun-house init`来安装核心package, 其他package都需要手动npm install
