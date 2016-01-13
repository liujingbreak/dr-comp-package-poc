
All your contributes are npm modules which will be published to company's **Sinopia** server.

### Pure Bower component
> A folder only contains file _bower.json_, no _package.json_.

Specifics of bower.json handling.
##### Required attributes
- **main**
List of browser side entry files
- **name**
Unique identifier string like `@dr/home-page`, lowercase, a-z, can contain digits, 0-9, can contain dash or dot but not start/end with them.
Must be preceded by `scope` name `@dr/`.
> about scope `@dr/`, please refer to [bower-sinopia-resolver](https://www.npmjs.com/package/bower-sinopia-resolver)

Refer to
[bower.json specification](https://github.com/bower/spec/blob/master/json.md)

During compilation, a `package.json` will be generated, and this component will be `npm publish` to company's **Sinopia** server as a NPM module.

### Node module
> A folder contains file _package.json_, it may also contain *bower.json*.
Specifics of package.json handling.



### Company package
