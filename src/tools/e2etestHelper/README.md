End-to-end Test
==========
[Selenum web driver doc](http://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/)
### Test Spec directory

Any file in `<project-root>/e2etest/spec` is considered as test spec file.

Ideally you should group your test specs in subdirectories like:

```
<project-root>
	└── e2etest
		 └── spec
			 └── logingroup
					└── homePageITSpec.js

```

### Configure your test environment
> Skip this, if you have put browser driver in environment PATH

1. In `config.yaml` or `config.local.yaml`, add following lines:
	```yaml
    e2etestHelper:
       selenium:
           driverPath: '..'
	```
	It is where you put your browser driver if you want to run test against browser other than Firefox.


2. Optional setting
	```yaml
    e2etestHelper:
       tryConnectTimes: 5
	```
	By default, end-to-end test waits for server starting, it tries to connect server for 15 times at 1 seconds interval, you can add this `tryConnectTimes` to override this default retry times.


### Run test
Run test in Firefox
```
gulp e2e
```
Run test in Chrome (You need to download Chrome driver and config its location in config.yaml)
```
gulp e2e --browser chrome
```
Run test and start server automatically
```
gulp e2e --server <your app.js>
```

### Write your test spec
Spec file name must ends with `Spec.js`

```javascript
var Path = require('path');
var log = require('@dr/logger').getLogger(Path.basename(__filename, '.js'));
var helper = require('@dr/e2etest-helper');
var yourPage = require('../../pages/yourPage');
var _ = require('lodash');

describe('When server is started', function() {
	helper.setup(); // must call this to initialize WebDriver

	it('the home page should be available', function(done) {
		yourPage.get().then(() => {
		})
		...
		.then(done)
		.catch(e => {
			log.error(e);
			done.fail(e);
		});
	});
});
```
##### The objects injected to `e2etest` directory
You can access them in your test spec or Page object.
- `require('__config')`
	The global config object, e.g.
	```js
	var devMode = require('__config')().devMode;
	```
- `require('__injector')`

### Write your Page Object

```javascript
var Path = require('path');
var log = require('@dr/logger').getLogger(Path.basename(__filename));
var util = require('util');
var helper = require('@dr/e2etest-helper');
var basePage = helper.basePage;
var _ = require('lodash');

// Inherit base Page
util.inherits(YourPage, basePage);

function YourPage() {
	YourPage.super_.call(this, '');
	// define your page elements in constructor
	this.el('body', '.doc-home', true);
	this.el('mainSection', '.main-section', true);
}

_.assign(YourPage.prototype, {
	... your page actions
});


module.exports = new YourPage();
```

#### helper.basePage API
| Name | description
| - | -
| {constructor} helper.basePage(contextPath) | e.g. `''`, `'/login'`
| this.driver | Underneath Webdriver instance
| this.get(path) | Send get request to load current Page object. `path` is optional, if not empty it will be add to page's `contextPath`, e.g. `page.get('?lang=zh')` if page's context is '/login', the actual URL will be `http://localhost/login?lang=zh`
| this.el(elementName, selector, isRequired) | Define a page element, if `isRequired` is true, that element be be tested when `.get()` is called on Page object
| this[elementName] | {`ElementPromise`} Get defined page element, it calls `driver.indElement(selector)` lazily
| this.el(elementName) | same as `this[elementName]`

### Some help method on `e2etest-helper`

| Name | description
| - | -
| .driver | Underneath Webdriver instance
| .waitForElement(cssSelector [,errMsg , timeout]) | return Promise(WebElement)
| .wait(func [,errMsg , timeout]) | return Promise(true), `func` is a `function` that returns `true|false`, `timeout` is 5 seconds
| .statusCodeOf(path) | return a Promise, resolved to a number type `statusCode`
| .saveScreen(fileName) | Take a screenshot for browser and save to folder `dist` as `config.resolve('destDir')`
If you want to assert a response status code of a local HTTP Path, you may do like this,
```javascript
...
var Promise = require('bluebird');
it('"http://localhost:<port>/resource" Should return 200', (done)=> {
	Promise.coroutine(function*() {
		var statusCode = yield helper.statusCodeOf('/resource')
		expect(statusCode).toBe(200);
		done();
	})()
	.catch(e => {
		done.fail(e);
	});
});
```
### Useful (monkey-patched) API on WebElement

| Name | description
| - | -
| waitAndFind(css, timeout) | return Promise< Array < WebElement > >
| findElementsByCss(css) | return Promise < Array < WebElement> >
| findElementByCss(css) | return WebElementPromise
More on [http://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/index_exports_WebElement.html](http://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/index_exports_WebElement.html)

## Sample
Page Object `foobarPage.js`
```js
var util = require('util');
var helper = require('@dr/e2etest-helper');
var basePage = helper.basePage;
var _ = require('lodash');
//var Promise = require('bluebird');

util.inherits(FoobarPage, basePage);

function FoobarPage() {
	FoobarPage.super_.call(this, '?lang=zh');
	// Defined your page elements
	this.el('body', '.doc-home', true);
	this.el('mainSection', '.main-section', true);
	this.el('apiResult', '.api-result', false);
	this.el('apiError', '.api-error', false);
}

// If you want to extend Page `check` logic
//_.assign(FoobarPage.prototype, {
//	check: function() {
//		var self = this;
//		return Promise.coroutine(function*() {
//			self.faviconStatus = yield helper.statusCodeOf('/favicon.ico');
//			return yield FoobarPage.super_.prototype.check.apply(self, arguments);
//		})();
//	}
//});

module.exports = new FoobarPage();
```

Test spec `foobarSpec.js`
```js
var Path = require('path');
var log = require('@dr/logger').getLogger('test.' + Path.basename(__filename, '.js'));
var helper = require('@dr/e2etest-helper');
var foobarPage = require('../../pages/foobarPage');
var _ = require('lodash');
var Promise = require('bluebird');

describe('When server is started', function() {
	helper.setup();
	beforeAll(() => {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 20 * 1000;
	});

	it('the home page should be available', function(done) {
		Promise.coroutine(function*() {
			yield foobarPage.get();
			expect(foobarPage.faviconStatus).toBe(200);

			helper.driver.sleep(1000); // or `yield Promise.delay(`1000)`
			var url = yield helper.driver.getCurrentUrl();
			expect(url.endsWith('#/')).toBe(true);

			var text = yield foobarPage.el('mainSection').getText();
			expect(text.indexOf('foobar') >= 0).toBe(true);

			// API might takes some time to finish rendering, so do waitAndFind
			var results = yield foobarPage.el('apiResult').waitAndFind('li');
			expect(results.length > 2).toBe(true);

			// Expect no errors
			var errors = yield foobarPage.el('apiError').findElementsByCss('.message');
			expecr(errors.length === 0).toBe(true);
			done();
		})()
		.catch(e => {
			log.error(e);
			done.fail(e);
		});
	});
});

```
