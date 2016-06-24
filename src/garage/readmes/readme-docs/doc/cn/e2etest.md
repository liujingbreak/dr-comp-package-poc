End-to-end and integration Test
===========
> You are not limited to choose your own way to implement end-to-end test

We adopt [Selenium webdriver](http://seleniumhq.github.io/selenium/docs/api/javascript/) as the browser automation test engine and Jasmine 2 as test framework.

At your project's root directory,
```
npm install --save-dev @dr/e2etest-helper
```

@dr/e2etest-helper
--------
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
	YourPage.super_.call(this, '/login');
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
| this.get(path) | Send get request to load current Page object. `path` is optional, if not empty it will be add to page's `contextPath`, e.g. `page.get('?lang=zh')` if page's context is '/login', the actual URL will be `http://localhost/login?lang=zh`
| this.el(elementName, selector, isRequired) | Define a page element, if `isRequired` is true, that element be be tested when `.get()` is called on Page object
| this[elementName] | {`ElementPromise`} Get defined page element, it calls `driver.indElement(selector)` lazily
| this.el(elementName) | same as `this[elementName]`

### Some help method on `e2etest-helper`

| Name | description
| - | -
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
