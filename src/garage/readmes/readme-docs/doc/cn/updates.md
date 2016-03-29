Updates
=======
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
