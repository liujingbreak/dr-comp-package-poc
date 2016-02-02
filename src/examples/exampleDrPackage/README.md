A demo module package
=====================

This package demonstrates a comprehensive packages which contains both node side code and static browser side code.

Write a simple package
-------------------
Firstly, make sure server can run.
Go to root folder, run:
```
npm install
gulp link
gulp build
npm start

```
Let me pray for no error message shown in your terminal.

(Yes, I added a new gulp task called `build`, it does few tasks inside, I will also pack task `link` into it later on.
I moved all private module dependencies to `/package-recipe` folder)
...

Let me assume everything above works successfully, then
#### start to write a node package

Create an empty folder under `/src`, it could be a sub-folder of any level deep,
as long as there is file `package.json` in that folder,
like this one: [package.json](package.json),
> you can also create package.json by command `npm init`

**package.json properties**:
- name -
	must begin with a `scope` prefix "@dr/".
	> During gulp build and server starting process, the platform scans for module with this scope name, it is configured in [config.json](../../../config.json)
- main - node side entry js file

~~- browser - browser side entry js file (optional)~~

- dr.bundle - the final browser-side js bundle file
	> Several packages can define same dr.bundle, so that their browser-side js file will be grouped to single bundle file.

- dr.entryView - the entry node server side html template
	> `gulp compile` reads this file, automatically adds script include element in it and outputs to `/compiled` folder

- dr.entryPage - the entry static html file
	> `gulp compile` reads this file, automatically adds script include element in it and outputs to `/static` folder

#### Write an entry js file
sample [server/main.js](server/main.js)

`module.exports` must be an object which has a function type property named `activate`

```
module.exports = { activate: function(api) {} }
```
Platform will pass a parameter `api` object to this function, we can define routers and middleware in that function.

> Maybe we can refactor this `activate()` thing later, use `vm` run js files and pass in global variable `api`

#### API object
##### express server related member functions:
- .router()
- .use()
- .param()

checkout out [setupApi.js](../../core/server/setupApi.js)
##### other member functions and properties:
- .packageName
- .packageInstance
- .contextPath
- .isBrowser()
- .isNode()
- .eventBus
- .config
- .getCompiledViewPath()

check out [nodeApi.js](../../../lib/nodeApi.js) and [browserifyBuilderApi.README.md]([../../compile/browserifyBuilderApi.README.md])
