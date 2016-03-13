A Builder package based on Browserify
======

It scans all browser side packages, use Browserify and Parcelify to pack them into bundle files base on configuration in package.json.

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
