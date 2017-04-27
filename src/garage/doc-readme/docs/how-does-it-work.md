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
- #### 用于node server启动后被调用的package

	> package.json 中没有定义`"dr.type"` 或者定义值为 `core`,
	 `"main"` 属性指向存在的文件

	比如 @dr-core/express-server

	例如主文件exports object.activate 为function:
	```javascript
	module.exports = {
		activate: function(api) {

		}
	}
	```

- #### 用于被浏览器运行的package

	> package.json 中没有定义`"dr.type"`, `"browser"` 属性指向存在的文件

- ####  用于编译其他package的组件package

	> package.json 中 `"dr.type"` 值为 `builder`，需要"dr.bundle"有值
	并且 `"main"` 属性指向存在的文件

	每次执行`gulp compile` 会遍历recipe中符合builder特征package, 根据"dr.priority"排序，依次调用。 package 需要exports特定的Object.

	例如主文件exports object.compile 为function:
	```javascript
	module.exports = {
		compile: function(api) {
			return Promise.resolve();
			// or return gulp stream
		}
	}
	```
	例如： @dr-core/browserify-builder
