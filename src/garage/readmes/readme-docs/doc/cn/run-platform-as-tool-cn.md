依赖平台的开发方式
============

现在是时候用这个平台开发一个新Web app的时候了。


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
./node_modules/.bin/web-fun-house init
```

你的目录会是

```
project-dir/
	├─ node_modules
	|		├─ web-fun-house
	|		└─ .bin
	|		
	├─ app.js
	├─ config.yaml
	├─ config.local.yaml
	├─ log4js.json
	├─ gulpfile.js
	├─ src/
	└─ package.json
```
你可能还需要手工添加适合你项目的 `.gitignore`, `.npmignore` 文件。

### 3. 安装平台默认组件
这个步骤是用来`npm install` 一些核心的功能组件, 例如
@dr-core/browserify-builder, @dr-core/express-server 等

执行
```
gulp install-recipe
```
目录会是:
```
project-dir/
	├─ node_modules
	|		├─ @dr/
	|		└─ @dr-core
	|
	├─ hellow-world-recipe/
			└─ package.json
	...

```
`node_modules` 下会install 组件到`@dr`, `@d-core`

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
```
编辑 `config.yaml` or `config.local.yaml`, 修改`installedRecipes`属性

```yaml
installedRecipes:
    - node_modules/@dr/garage-recipe
```

```
gulp compile

node app.js
```

#### 6. 安装他人贡献的组件
第5步介绍了一种引入其他组件的方法：install recipe。
也可以单独`npm install xxx`， 然后手工添加到某个recipe `pakcage.json`的属性 `dependencies`中
