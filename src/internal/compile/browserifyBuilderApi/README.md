Extra API function
=============

> You don't need to call this module directly.
This package is an API provider.


Node API object
--------
This module monkey-patch a new function to API object.

```javascript
api.getCompiledViewPath('views/index.html');
```

it returns string like,

```
/server/your-package/views/index.html
```

Browser API Object
---------

Browser API object is available through local variable `__api`

e.g.

```javascript
console.log(__api.packageName);
```

#### Api properties
| name | description
| -- | --
| packageName | package name like `@dr/xxx`
| packageShortName | package name without scope name
| contextPath | Node server context path of current, e.g. `/xxx` packageShortName

#### Api methods
| name | description
| -- | --
| assetsUrl | `function(package, path)` parameter `package` is optional, default value is current package
| config | `funtion()`
