Translatable content scanner & resource generator
========

### How to generate translatable files

Run Gulp command
```
gulp compile --translate [-p <package-name>]
```
#### 扫描的规则
`gulp compile --translate` 会扫描指定package下的所有`.js, .html`文件
- `.html` 文件，会使用**cheerio** 查找所有符合query `[translate]`的element, 也就是带有属性translate的element:
	```html
	<any-element translate>KEY1</any-element>
	<any-element translate="KEY2"></any-element>
	```
	`KEY1`，`KEY2`都会被认为是i18n message key

- `.js` 文件, 会在`acorn`语法分析器生成的AST里查找function name是
	`$translate` or `$translate.instant` 的call expression, 第一个参数被视为message key：
	```javascript
	$translate('KEY1');
	$translate.instant('KEY2', someObject...);
	```

	所有这些都是会被识别, 这样你可以编写i18n的逻辑，而且不用费时去手工添加key文件：
	```javascript
	scope.text1 = $translate('KEY1');
	scope.text2 = $translate
		.instant('KEY1');
	```

	除了$translate, $translate.instant， 还可以配置增加自定义的被扫描function name， 比如增加"t()"， 添加到config.yaml:
	```yaml
	translate-generator:
	    scanMethodNames:
	            - t
	```
---------

### Show i18n text via AngularJS 1 Directive
If you are using AngularJS 1, lucky you are, we have already made directive and service to work with this tool.

In your entry browser side JS file, add i18n text resource into `drTranslateService`
```js

var m = angular.module('yourModuleName', [])
.run(function(drTranslateService) {
	drTranslateService.addResource(__api.packageShortName, require('@dr/sample/i18n'));
});

require('@dr/translate-generator').init(m);

```
Assume your package name is "@dr/sample" which is actually refereced by `__api.packageShortName`.
In Your AngularJS template file:

```html
...
<div ng-controller="someController">
...
	<div translate-scope="sample">
		<span translate>textKey1</span>
		<span t>textKey2</span>
	</div>
...
</div>
```
`textKey1` and `textKey2` is your i18n text key also as default text content if there is no such key in i18n resource file

`translate-scope="sample"` tells AngularJS the i18n resource is from the one which is added
to drTranslateService with `__api.packageShortName` early in JS file, so mark `translate-scope=` only once in a very top level element of
your template file.

We need `translate-scope` to distinguish those i18n resources from different package,
since Angular template may be consist of sub-template and directives from multiple packages.

Directive `t` and `translate` are same, they require to work with `$scope`

--------

### Reference i18n resource in Javascript
It is simple,
Since the scanner tool scans for function call expression of `$translate(key)`, so we wrap all i18n text keys in that function,
and define a function `$translate()` where you need.
```js
var myLocaleText = $translate('textKey'); // This line will be scanned, results to an i18n text resource key "textKey" being generated
...
/** return actual i18n text by the key*/
function $translate(key) {
	return require('@dr/doc-home/i18n')[key] || key;
}

```
