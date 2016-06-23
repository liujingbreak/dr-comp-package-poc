简单的依赖注入实现
----------
[require-injector](https://www.npmjs.com/package/require-injector)

修改Project目录下的2个文件可以实现对require()的依赖注入，或者说是替换。
- 浏览器端package的依赖注入(替换)\
	browserify-inject.js
- Node package的依赖注入\
	inject.js

通过注入替换组件的依赖，可以达到灵活的扩展或替换组件的目的。

Browser 的package依赖注入是通过gulp compile时的require()语句替换实现的。Node package则是通过运行时hack `Module.prototype.require`来动态实现。

例如获取API的方式 `require('__api')` 中__api本身就是被注入的变量，并非真的某个package。

再例如，当某些组件`require()` 第三方library jquery时，代码中会有大量的
```js
require('jquery');
```
假设某个web app决定使用CDN jquery而不是自己打包jquery，但是同时用到了那些对jquery有依赖的公共组件，简单的方式就是将原本`require('jquery')`替换为`windows.jQuery`.

只需要修改browserify-inject.js
```js
module.exports = function(injector) {
	// 所有require('jquery')的地方在compile后变成
	// (function() {
	//	return window.jQuery;
	// })();
	inject.fromAllComponents().factory('jquery', function() {
		return window.jQuery;
	})
}
```
### 预先已经被注入的fake module
当gulp compile, app.js运行时，可以获取以下预先注入的依赖
- `require('__api')` 获取API object
- `require('__injectorFactory')` 获取injector对象构造器
- `require('__injector')` 获取当前node injector对象本身

### Injector API
- `inject.fromAllComponents()`
- `inject.fromPackage(packageNames)`
- `.factory(oldPackageName, factoryFunction)`
- `.value(oldPackageName, newValue)`
- `.substitue(oldPackageName, newPackageName)`

具体参考
[require-injector](https://www.npmjs.com/package/require-injector)
