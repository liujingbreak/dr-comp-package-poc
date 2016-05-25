End-to-end Test
==========
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
In `config.yaml` or `config.local.yaml`, add following lines:
```yaml
e2etest:
    selenium:
        driverPath: '..'
```
It is where you put your browser driver if you want to run test against browser other than Firefox.

### Run test
Run test in Firefox
```
gulp e2e
```
Run test in Chrome (You need to download Chrome driver and config its location in config.yaml)
```
gulp e2e --browser chrome
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
	beforeAll(helper.waitForServer);

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
	YourPage.super_.call(this, '');
	// define your page elements
	this.el('body', '.doc-home', true);
	this.el('mainSection', '.main-section', true);
}

_.assign(YourPage.prototype, {
	... your page actions
});


module.exports = new YourPage();


```

### Some help method on `e2etest-helper`

| Name | description
| - | -
| .statusCodeOf(path) | return a Promise, resolved to a number type `statusCode`
If you want to assert a response status code of a local HTTP Path, you may do like this,
```javascript
...
it('"http://localhost:<port>/resource" Should return 200', (done)=> {
	helper.statusCodeOf('/resource')
	.then(statusCode => {
		expect(statusCode).toBe(200);
		done();
	})
	.catch(e => {
		done.fail(e);
	});
});
```
