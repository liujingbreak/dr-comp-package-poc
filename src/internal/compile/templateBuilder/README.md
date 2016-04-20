Template Builder
=========
Under the hood, this is just a transform plugin for Browserify.


### Compile template in server side only during compilation phase. (vs Server side rendering)

If you have some initial pages contains configurable data, or your web app runs on pure static CDN stack, you can pre-compile view template during build phase.

As long as your data is not so much dynamic like fetching from database and result changes based on per request, you should consider giving up server side rendering like calling express's  `request.render()`.

## Usage

Your package's main node entry JS file
```javascript
module.exports = {
	onCompileTemplate: function(relativeHtmlFilePath) {
		return {
			locals: getLocalVariablesForFile(relativeHtmlFilePath)
		}
	}
};
```
exports an object that contains a function type property `onCompileTemplate` as compiling handler.

`relativeHtmlFilePath` is a package relative path of that template file. If you put file in
```
	<package-folder>/view/index.html
```
you got `relativeHtmlFilePath` value equals `"view/index.html"`.

That function returns a Swig options object, which will be passed to `swig.render(templateContent, swigOptions)`.

Yes, under the hood there is a *Swig* template engine.

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

If your `onCompileTemplate()` returns falsy value like `null`, then that specific file won't be compiled.

## Which files can be considered as compilable templates
- File extension name is '.html'
- In Browserify dependency graph, meaning it is `require('xxx.html')` in browser side JS file
- The file you configured as `"dr"."entryPage"`
 > `"dr"."entryView"` file will not be considered as compilation template, because it is already as a express server side rendering template, so no need to do one more round compiling.
