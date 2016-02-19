# parcelify-module-resolver

A parcelify transform

#### Include less file variable and mixins definition file from another packaage into current file
```css
@import "npm://@dr/doc-less-var";
```

In package `@dr/doc-less-var`, the package.json must contains a "style" property

```json
{
  "name": "@dr/doc-less-var",
  "version": "0.0.0",
  "description": "less variables and mixins",
  "style": "less/include.less",
  "dr": {
	  "bundle": "core"
  },
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "LJ",
  "license": "ISC"
}
```
> This is done by **less-plugin-npm-import**
