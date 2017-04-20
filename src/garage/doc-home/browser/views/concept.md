1. ### @dr 组件包是一个标准Node package
	- 包含`package.json`文件， `README.md`文件
	- `package.json` 有特殊的属性`"dr"`不为`undefined`, `null`

2. ### @dr 组件包的类型
	##### 1. Webpack 可打包的客户端入口组件
	- 含有入口客户端JS文件 (一个)
	- 含有入口客户端页面 (任意多个)
	##### 2. 被依赖libaray 包含打包chunk信息，国际化信息
	##### 3. NodeJS HTTP server 组件
	Express router, middleware
	##### 4. NodeJS 打包编译扩展组件
	扩展Webpack或者 `drcp compile`功能的
	##### 5. End-to-end 测试
	以用例为场景的自动化测试代码


3. ### @dr 组件包的内容
	- Web打包资源 (Webpack可打包`module`文件 JS，CSS, HTML, Markdown, LESS, TXT ...)
	- 任意Web静态资源文件 （aka "assets"） (HTTP可访问资源)
	- NodeJS 端本地JS文件， 本地访问的任意文件
	- 单元测试代码


