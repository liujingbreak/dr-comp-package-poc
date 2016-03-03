# parcelify-module-resolver

A parcelify LESS transform

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


> This is inspired by **less-plugin-npm-import**

#### Static Assets URL

You may defined a css property which contains url value in following style

```less
.some-selector {
	background-image: url(assests://@dr/my-package/background.jpg);
}
.some-equivalent {
	background-image: url("assests://@dr/my-package/background.jpg");
	background-image: url('assests://@dr/my-package/background.jpg');
}

```

URL prefix 'assests://' will be replaced with calculated value of `config().staticAssetsURL + '/assets/' + packageShortName`
