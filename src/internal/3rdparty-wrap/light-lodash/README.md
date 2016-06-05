Subset fo lodash library for Browser pack
---------
> In fact this is no very necessary since the gzip size of original lodash module
is only 23.54 kB, this light-lodash is about 16kb

```js
module.exports = {
	assign: require('lodash/assign'),
	each: require('lodash/each'),
	has: require('lodash/has'),
	size: require('lodash/size'),
	keys: require('lodash/keys'),
	map: require('lodash/map'),
	includes: require('lodash/includes'),
	some: require('lodash/some'),
	every: require('lodash/every'),
	values: require('lodash/values'),
	forOwn: require('lodash/forOwn'),

	create: require('lodash/create'),
	get: require('lodash/get'),
	set: require('lodash/set'),

	bind: require('lodash/bind'),
	throttle: require('lodash/throttle'),
	debounce: require('lodash/debounce'),
	spread: require('lodash/spread'),

	endsWith: require('lodash/endsWith'),
	startsWith: require('lodash/startsWith')
};
```

And the compile function will automatically add above `lodash/*` to `config.vendorBundleMap` setting during compile time,
so that manual configuration for config.yaml `vendorBundleMap` properties is not needed.

It will be like,
```yaml
vendorBundleMap:
  bundleName:
    - lodash/assign
    - lodash/each
    ...
```
