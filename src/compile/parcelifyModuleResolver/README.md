# parcelify-module-resolver

A parcelify transform, which is sort of combined the functionality of `parcelify-import-resolver` and `less-css-stream`.

# example

You have a parent module with a `_settings.scss` file and want to use those settings in a plugin for said module:

``` scss
@import "!resolve(@dr/module)/less/include.less)";

body {
  background: @main-color;
}
```

Without the resolver, this would fail, because sass cannot import the file. The resolver replaces the path with an absolute path in order to allow sass to load the file without issues.

# how to use

Just add the transformer to your `transforms` property in your `package.json`:

```
"transforms" : [ "@dr/parcelify-module-resolver"]
```


# license

MIT
