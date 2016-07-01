Template Builder
=========
Under the hood, this is just a transform plugin for Browserify.


### Compile template in server side in compilation phase. (vs Server side runtime rendering)

If you have some initial pages contains configurable data, or your web app runs on pure static CDN stack, you can pre-compile view template during build phase.

As long as your data is not so much dynamic like fetching from database and result changes based on per request, you may consider giving up server side runtime rendering like calling express's  `request.render()`. With no runtime rendering
involve, your compiled HTML file can be served by CMS, CDN to be accelerated.

## Setup package.json
First of all, the package must act as a Browser side package,
package.json
```json
{
	...
	"browser": "browser.js",
	"main": "server.js"
}
```
Not matter what content `browser.js` has, it could be empty file, but the file must exist,
so that Browserify builder can consider this package as compile target.

## Set Local variables for template file
Under the hood, there is a *Swig* template engine runs as a Browserify transform.

Your package's main node entry JS file `server.js`
```javascript
exports.onCompileTemplate = function(relativeHtmlFilePath, swig) {
	var locals = getLocalVariablesForFile(relativeHtmlFilePath);
	return locals ? { locals: locals } : null;
	// return null or any falsy value to skip compilation
};
```
Exports object contains a function type property `onCompileTemplate` as compiling handler.

- Parameter `relativeHtmlFilePath` is a package relative path of that template file. If you put file in
	```
		<package-folder>/view/index.html
	```
	you got `relativeHtmlFilePath` value equals `"view/index.html"`.

- Parameter `swig` is swig instance, just in case you want to do something to it.

That function returns a Swig options object, which will be passed to `swig.render(templateContent, swigOptions)`.

You html template file maybe like:

```html
<div>
 {= localVariable =}
</div>
```
Yes, default Swig options is
```javascript
{
	"varControls": ['{=', '=}'],
	"filename": <absolute file path>
}
```
You may override any options by the returned value from `onCompileTemplate()`, check out [Swig doc](http://paularmstrong.github.io/swig/docs/api/#render).

If your `onCompileTemplate()` returns falsy value like `null`, then that specific file will be skipped.

## Which kind of file will be considered as templates
- File extension name is '.html'
- In Browserify dependency graph, meaning it is `require('xxx.html')` in browser side JS file
- The file you configured as `"dr"."entryPage"` in package.json
 > `"dr"."entryView"` file will not be considered as compilation template, because it is already as express server side rendering template, so no need to do one more round compiling.

## Configure Swig
If you want to set filter to Swig or call some other API on swig before compiling starts.

Create a package, set its package.json `"dr.builderPriority"`'s value to "`before @dr/templateBuilder`".

```json
	dr: {
		"type": "builder",
		"builderPriority": "before @dr/template-builder"
	}
```

And the main entry file is like:

```javascript
exports.compile = function() {
	var swig = require('@dr/template-builder').swig;
	// or require('swig')
	// Do things to swig instance
}
```
Now you can manipulate Swig instance.

Yout can also obtain swig by `require('swig')` in that package, it will be the same instance returned from `@dr/template-builder`.
