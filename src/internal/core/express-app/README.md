Express server
==========

This package contains Express web framework as core package.
Also this package is API provider.

### new API

New Node API methods
| Name | description
|-- | --
| .router() | return an Express Router object
| .use() | Express use() method, to bind middleware
| .param() | Express param() method
| .express | express instance, so that you can access some express middleware, like `api.express.static`
check [setupApi.js](setupApi.js)

Above API methods must be called within `module.exports.activate()` function
e.g.
```javascript
module.exports = {
	activate: function(api) {
		api.router().get(function(req, res) {
			res.render('/template.html');
		});
	}
}
```
