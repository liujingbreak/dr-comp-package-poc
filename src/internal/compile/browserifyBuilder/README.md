A Builder package based on Browserify
======

It scans all browser side packages, use Browserify and Parcelify to pack them into bundle files base on configuration in package.json.

We are able to deal with special `require()` function call during Browserify build transform phase.

```javascript
require('./some-{locale}.js');
```
where `{locale}` will be replaced with `--locale` parameter of gulp compile command, default is `zh`
```
gulp compile --locale en
```


module exports is an object:
| members | description
| -- | --
| compile(api) | function, called by `gulp compile` command
| addTask({function} run | function, accept 1 function type parameter `task()` which should return a Promise that will resolve to null or a function `getData(browserApiPrototype, entryPackageName)`, browserifyBuilder will call that function with a paraemter `browserApiPrototype` passed in, so that in this way, another `builder` type package can bind JSON object to browserApi prototype which will be available in browser side js `__api`, checkout how `@dr/ng-i18n` works.

### Priority
3000


Event
----------
| name | descriptions
| -- | --
| `afterCompile.browserify-builder` | emitted after this builder package is done

```javascript
api.eventBus.on('afterCompile.browserify-builder', onCompiled);
```

Compile time API
-----------

New API property is monkey patched during `gulp compile`, it is available to other `builder` type packages.

```javascript
module.exports = {
	compile: function(api) {
		console.log(api.packageInfo);
	}
}

```

| name | description
| -- | --
| .packageInfo | object.<PackageInfo> all browser packages information
| .bundleDepsGraph | object.<{string} entryPackageName, Object.<{string} bundleName[], boolean> bundles dependency information for each entry package

PackageInfo:
```
	{
		allModules: packageBrowserInstance[],
		moduleMap: {
			packageName: packageBrowserInstance // key is package name
			...
		},
		bundleMap: {
			bundleName: packageBrowserInstance[]
		},// key is bundle name
		entryPageMap: {
			packageName: packageBrowserInstance[]
		},// key is package name, value is depended package instances
	}
```
