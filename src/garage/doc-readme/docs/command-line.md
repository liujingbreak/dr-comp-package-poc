开发和命令行工具
===============
## 第一配置开发环境
```
npm set registry http://npm.dianrong.com
npm install -g dr-comp-package-cli
```
## 创建workspace
新建一个空目录作为workspace
> 也可以使用项目的目录作为workspace, 缺点是workspace里会生产很多临时文件, 需要配置`.gitignore`.
```
mkdir workspace
cd workspace
```
安装 dr-comp-package, 和关联项目, 之后需要再次安装所关联项目各自的依赖
```
npm install dr-comp-package
drcp project -a myproject1 -a myproject2
# If workspace directory is current project directory:
# drcp project -a .
npm install
```

## 启动开发server和开启watch模式
#### `node app --ww [-c <config-file> -c ...] [-p <entry-component-name> -p ...]`
- `-c`指定依次读取的配置文件, 后面文件覆盖前面的文件内容, 默认**config.yaml**永远是最先读取的
- `-p`指定webpack打包多个入口组件, 组件名称可以简写不带scope, 不带`-p`参数, 打包和watch所有的entry组件, 对于关联项目和安装的组件较多时, 可能会太慢, 所以`-p`用于缩小范围, 提高watch速度
- `--ww` 同 `--webpack-watch`, 开启webpack 编译组件打包到内存, 并开启watch模式, 不带此参数时, 不会有编译和打包, 只是启动Node server和相应的所有"server"类型组件.

比如要启动server并且, 只打包运行组件`@dr/doc-home`
```
node app --ww -p doc-home
```

## 生产模式打包和运行server
```
drcp compile-prod [-c <extra-config-file> -c ...]
node app [-c <extra-config-file> -c ...]
```
建议配置到workspace package.json文件的npm script属性, 方便执行

## 命令行帮助
在workspace目录下, 执行`drcp` 查看帮助

## 命令简介
#### 1. `drcp init`
用于生成初始的所有配置文件, 扫描关联项目和已安装组件的package.json, 生成对应的`config.yaml`, `config.local.yaml`, ...等配置文件, 修改workspace目录下的package.json, 添加组件级别的第三方依赖到package.json中.

每次`drcp clean`后, 每次对关联项目的组件有增删和package.json有改动后, 需要执行此命令, 如果又发现`+`新的组件的新增依赖, 需要再次执行
`npm install`

#### 2. `drcp project [-a <project-dir>, -a ...]`
会先执行`drcp init` 然后列出关联的项目, `-a` 是新关联一个项目目录到当前的workspace, `<project-dir>` 可以是项目目录相对当前workspace目录的路径

e.g.
```
drcp project -a ../myproject1 -a ../myproject2
```

#### 3. `drcp compile [-c <config-file> -c ...] [-p <entry-component> ...]`
运行所有type为builder的组件, 尤其是用webpack2打包输出静态资源到`dist/static` 目录下
> `-c <config.xx.yaml> -c <override config file> -c ...` 指定要读依次读取的配置文件, 后面的文件内容覆盖前面的内容, 当一个`-c <config>` 都没有时, 默认读取 `config.yaml`和`config.local.yaml`

> `config.yaml` 是永远会最先读取的, 不需要 `-c`指定

#### 4. `drcp compile-prod [-c <config-file> -c ...]`
和 执行`drcp compile -c <some nonexistent file name>`一样, 只是在不带任何参数`-c <config-file>`时, 默认只读取`config.yaml`, 不读`config.local.yaml`(开发模式的覆盖配置)


#### 5. `drcp clean` 
删除`dist`目录, `node_modules`下的symlinks, 当有删除某个整个组件源码目录后, 需要执行此命令, 之后再次`drcp init`恢复workspace

#### 6. `drcp ls [-c <config-file> ...]`
按照类别列出现在workspace中所有已经关联项目的和`npm install`进来的@dr组件. 其中Web客户端组件会按照`chunk/bundle`的分配归类, server端组件会按照运行优先级排序.

可以用来判断组件是否成功识别出来, 会不会被实际运行/打包, chunk是否分配合理.
```
==============[ BROWSER COMPONENTS ]==============
Webpack chunk ------------------- common-lib -------------------
 1. jquery                              (node_modules/jquery)
 2. @dr/lodash3                         (../web-fun-house/src/garage/3rdparty-wrap/lodash3)
 3. fastclick                           (node_modules/fastclick)
 4. style-loader                        (node_modules/style-loader)
 5. css-loader                          (node_modules/css-loader)
 ...
Webpack chunk --------------------- ui-lib ---------------------
 13. angular-ui-router                   (node_modules/angular-ui-router)
 20. @dr/angular-lazy                    (../web-fun-house/src/garage/angular-lazy)
 21. @dr/light-respond-js                (../web-fun-house/src/garage/light-respond-js)
 22. @dr/ui-router                       (../dr-common/src/3rd-party-wrap/ui-router)
 ...
 ==============[ SERVER COMPONENTS ]===============

 1. @dr/http-server                 [core] priority: 999999   (../web-fun-house/src/internal/core/httpServer)
 2. @dr-core/browserify-builder-api [core] priority: 5000   (../web-fun-house/src/internal/compile/browserifyBuilderApi)
 3. @dr-core/express-app            [core] priority: 5000   (../web-fun-house/src/internal/core/express-app)
 4. @dr-core/browserify-builder            priority: 5000   (../web-fun-house/src/internal/compile/browserifyBuilder)
 5. @dr/comp-store                         priority: 5000   (../web-fun-house/src/garage/comp-store)
 6. @dr/example-entry                      priority: 5000   (../web-fun-house/src/examples/example-entry)
==============[ BUILDER COMPONENTS ]==============

 1. @dr-core/assets-processer    priority: 8000   (../web-fun-house/src/internal/compile/assetsProcesser)
 2. @dr/light-lodash             priority: before @dr-core/browserify-builder   (../web-fun-house/src/garage/3rdparty-wrap/light-lodash)
 3. @dr/static-site              priority: before @dr/template-builder   (../dr-garage/src/liujing/static-site)
 4. @dr/template-builder         priority: before @dr/translate-generator
 ...
 ```
#### 7. `drcp lint [--pj <project-dir>]`
运行代码风格检测, `-p` 指定项目的目录(可以使相对路径), 不带`-p`就是全部已经关联的项目源码都会lint.
不同于使用webpack lint loader, `drcp lint`的范围扩大到Node server端组件的源码.
> 如果不是windows开发环境, git hook已经添加了`drcp lint`命令, 每次`git commit`前会执行当前项目的lint.
所以建议编辑器指定项目目录下 `.jshintrc`, `.jscsrc` 的文件检测代码风格

#### 8. `drcp test [--pj <project-dir>]`
运行指定项目中组件的单元测试, 每个组件目录下spec目录内`*Spec.js`会被视为unit test case, 基于**Jasmine 2**

#### 9. 其他命令在别的文档中具体介绍
- `drcp e2e` 运行自动化测试
- `drcp bump`, `drcp publish`, `drcp unpublish` 用于发布组件到private npm registry server
- `drcp install` 目前就是`npm install`, 以后可能替换为`yarn`之类的更好的工具




