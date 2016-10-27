A Builder package based on Browserify
======

It scans all browser side packages, use Browserify and Parcelify to pack them into bundle files base on configuration in package.json.

## Require() files types
For browser side Javascript file compilation, we are able to deal with special file types in `require()` function,
- .js, .json
- .html
- .yaml, .yml

## i18n bundle support
It can understand `require()` with parameter like '<package name>/i18n', meaning 'require' a locale resource which could be any `.js, .json, .yaml, .yml` module.
```javascript
require('@dr/some-package/i18n');
```

In i18n related files, It can understand in following line
```javascript
require('./some-{locale}.js');
```
where `{locale}` will be replaced with `locales` property from config.yaml during compilation.

```yaml
locales:
	- zh
	- en

```

module exports is an object:
| members | description
| -- | --
| .compile(api) | function, called by `gulp compile` command
| .addTransform(transforms) | `transforms` is a browserify Transform or an array of Transform, so that you can pre-process those files before browserify compiles them. Transforms are also applied to `dr.entryPage` which is configured in package.json.

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
### api
| name | description
| -- | --
| `.packageInfo` | object.<PackageInfo> all browser packages information
| `.bundleDepsGraph` | object<{string} entryPackageName, Object.<{string} dependencyBundleName, boolean> bundles dependency information for each entry package,  A relationship map of `entry package` -> `dependency bundles` structure
| `.bundleDepsGraph` | object<{string} entryPackageName, object<{string} locale, object<{string}> dependencyBundleName, boolean>>, A relationship map of `entry package` -> `locale` -> `dependency bundles` structure
| `.findBrowserPackageByPath(filePath)` | returns package name, it tells you which package a file belongs to
| `packageNames2bundles(packageNames)` | parameter `packageNames` is an array of package names, it returns corresponding bundle name that packages are belong to
| `replaceAssetsUrl(str, sourceFile)` | Replace all text `assets://...` to exact URL string, `str` is the text content, `sourceFile` is absolute file path of that text content, replacement involves setting from "browser-injector.js", so you must provide `sourceFile` path as parameter. Return replaced content.

**PackageInfo type**:

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

### Resolve conflict with AMD tool like requireJS
If our JS bundle needs to be run with requireJS in same page, there will be conflict of using keyword `require` sometimes. In this case, we can add a special option to file `config.yaml`, e.g.
```yaml
browserify-builder:
	replaceRequireKeyword: __req
```
This will tell the `gulp compile` command to parse and replace all `require` keywords (also including `require.ensure()`) from final JS bundle files.
> The replacement follows rules like only replacing `require` in function call expression, assignment expression, skipping cases like using `require` as object property key or property name of a member expression
