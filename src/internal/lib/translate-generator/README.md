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
	`KEY1`，`KEY2`都会被认为是locale message key

- `.js` 文件, 会在esprima语法分析器生成的AST里查找function name是
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
