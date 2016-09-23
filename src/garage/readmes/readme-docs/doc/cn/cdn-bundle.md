部署静态资源到非本地域名，配置CDN
--------
### 静态资源部署

如果你想要将所有的静态资源，即编译后的`dist/static`部署到另一个域名和HTTP服务器(例如CDN服务器)的话，
1. 配置`config.yaml`/`config.local.yaml`:
```yaml
// Assume your deployed URL is http://host-foo/path-bar
staticAssetsURL: 'http://host-foo/path-bar'
```
2. `gulp build` or `gulp compile`
3. 将`dist/static`下的完整文件结构上传至目标服务器
> Behind scenes, @dr/assests-processer会在gulp compile时替换每个`assets://`开头的URL，LABjs也`staticAssetsURL`从加载bundle文件

### 替换本地bundle为外部的URL资源
bundle 包含`dist/static/js` 下的对应名称Javascript文件和`dist/static/css/`下对应的CSS文件。
浏览器运行入口HTML页面时，LABjs会加载的bundle对应的那些文件。

如果你想要单独替换某个bundle为另一个URL地址上的Javascript or CSS资源,
例如, 
1. 在开发环境对package "@dr/bar"有依赖, 为了开发方便你可能安装到了本地
```
npm install @dr/bar
npm install @dr/foo
```
2. 你的Javascript:
```js
require('@dr/bar');
require('@dr/foo');
```
3. 你的config.yaml 配置bundle named as "foobar", 并且有一组URL资源对应
```yaml
vendorBundleMap:
   foobar:
      - @dr/bar
	  - @dr/foo

externalBundleMap:
   foobar:
      - //www.foobar.com/foobar.js
      - //www.foobar.com/foobar.css
```
4. 执行`gulp build`/`gulp compile`

假如bundle从来没有`npm install`到本地打包环境, Browserify将无法对bundle内容进行
语法分析，将无从得知包含哪些package module(当然对于第三方非CommonJS style的JS
library, 并不需要对其语法分析)， 你可以配置另一种形式的**externalBundleMap**, 用
`URLs`, `modules`明确的告诉bundle包含哪些package可以被`require()`， 这个时候不要
配置对应的**vendorBundleMap**。
```yaml
externalBundleMap:
   foobar:
      URLs:
        - //www.foobar.com/foobar.js
        - //www.foobar.com/foobar.css
      modules:
        - @dr/bar
        - @dr/foo
   jquery:
       - https://code.jquery.com/jquery-1.12.3.min.js
```
> vendorBundleMap是用来告诉打包时怎样分配package到bundle(覆盖package.json中的"dr"."bundle"属性)，
会对每个配置过package
进行Browserify打包，对于依赖纯外部CDN的资源，如果本地没有`npm install`过，请不要配置到对应的
vendorBundleMap

