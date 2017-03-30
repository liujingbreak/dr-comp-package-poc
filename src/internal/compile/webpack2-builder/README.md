The core build component based on Webpack 2
=========
## Unlike normal Webpack projects

- less-loader '@import ~<package>` is hijacked by lib/npmimport-css-loader.js which works with require-injector

- Webpack advanced mechanism to resolve files, aka `webpack.config.js`'s `resolve.alias` is not recommended,
should use require-injector instead, by set `browser-inject.js`.

- Setting package.json property `"style"` is just like calling `require('xxx.css')` from an package's main JS file.

### entry-html-loader
It marks all DR component entry pages in `compiler._lego_entry[pagePath]` which later on will be read by
**multi-entry-html-plugin**

### manual-chunk-plugin
Used instead of **CommonsChunkPlugin** which doesn't support real muti-entry chunk project.
> **CommonsChunkPlugin** works good in case like having one entry chunk and couple of `common library` Js chunk.

### multi-entry-html-plugin
Used instead of **HtmlWebpackPlugin**, supports inserting `<script>` and `<link>` for multiple HTML file of multiple entry chunk.
Also it inlines `manifest` chunk in entry HTML file.

### api-loader
Resolves `require('__api')` and `__api` expression statement, also works with **require-injector**.

### @dr-core/webpack2-builder/lib/html-loader
Replaces `assets://<component>/...` in *[src|href] from all html files.

### @dr/template-builder
Compiles all HTML resource as they are Swig-template file.
For details about how to defined Swig template local variables and other advanced setting,
please read readme of @dr/template-builder.

TODO: add according Webpack `module.fileDependency` for Swig tag `{% include "<file>" %}`

### Component configuration
> Each component should be configable, so that we can deal with differenct environment like `demo`, `production`...
For example, your web app probably wants to connect with different ajax API for different environment or to be more flexable and
reusable

TODO

## How to extend Webpack config file
In your main JS file of component
```js
require('@dr/webpack2-builder').tapable.plugin('webpackConfig', function(webpackConfig, cb) {
	// do something to webpackConfig
	cb(null, webpackConfig);
	// or encounter errors
	// cb(error);
});
```


