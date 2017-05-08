# Building tool

Some handy utilities used by @dr-core/browserify-builder

### Extended API method
`api.findPackageByFile(fileAbsolutePath)`
#### return `PackageBrowserInstance`
```js
{
	longName: "<package name>",
	shortName: "<package short name>",
	dr: {...},
	...
}
```

