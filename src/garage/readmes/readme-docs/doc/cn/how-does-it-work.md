平台是如何工作的
===========

Life cycle
-------------
平台的组件有三个运行环境

1. **gulp compile**

	部署前在开发环境，当执行命令 `gulp build` 或者 `gulp compile` 时

2. **Node**

	运行 `npm start` 时

3. **浏览器**

	当被加载到浏览器端运行时

所以对应的组件package按技术功能划分也有三种类型
- 用于完成编译功能的package

	> package.json 中 `"dr.type"` 值为 `builder`，
	package.json `"main"` 属性指向存在的文件
- 用于node server启动后被调用的package

	> package.json 中没有定义`"dr.type"` 或者定义了，但是值为 `core`
	package.json `"main"` 属性指向存在的文件

- 用于被浏览器运行的package

	> package.json 中没有定义`"dr.type"`, `"browser"` 属性指向存在的文件
