Use this package to pass `global` variables.
------
This package is __deprecated__!

Use API object, inject.js or browserify-inject.js to pass global variables instead.


> This way will not pollute `global` instance.
As long as no one cleans up `require.cache`

> ### Node side
> - Assign `global` variables
	```javascript
	require('@dr/environment')._setup(config, packageUtils, buildUtils)
	```

> - Consume `global` variables
	```javascript
	var config = require('@dr/environment').config
	```
