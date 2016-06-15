Gulp command usage
===============
在根目录下
- 执行gulp 查看帮助
- 初次编译 `gulp build`
- 每次修改过package后， `gulp compile [-b <bundle/packageName>]`
- 改动过 package.json, 新增减package，需要`gulp link`
- 清理环境 `gulp clean`
- `gulp watch [-p package]` 当发现js, less代码改动时，自动rebuild browser package， 但是不会刷新浏览器，需要手工刷新浏览器查看改动效果
> 为了性能考虑，gulp watch 是正对每一个package单独处理的,改动一个package只会自动重新build那一个package, 所以gulp watch 不能察觉package目录和新增和减少，任何对package.json的改动后都需要手工执行`gulp link`, `gulp compile`, 然后重新运行`gulp watch`

```
Usage: gulp <command> [-b <bundle>] [-p package]
gulp link [-r <recipe folder>] [-d <src folder>]

Commands:
  build           build everything from scratch, including install-recipe, link,
                  npm install, compile
  clean           cleanup build environment like dist/static folder, cache,
                  recipe package.json, even those private modules in
                  node_modules folder
  clean:dist      only cleanup dist/static folder, do not cleanup private
                  packages in node_modules
  compile         link recipe, compile package into static browser bundles
  lint            source code style check
  install-recipe  link newly changed package.json files to recipe folder and
                  `npm install` them, this makes sure all dependencies being
                  installed
  watch           automatically rebuild specific bundle file when changes on
                  browser packages source code is detected, if you change any
                  package.json or add/remove packages, you need to restart watch
                  command
  link            link newly changed package.json files to recipe folder
  build-prod      disable config.local.yaml, build for production environment
  publish         npm publish every pakages in source code folder including all
                  mapped recipes
  unpublish       npm unpublish every pakages in source code folder including
                  all mapped recipes of version number in current source code
  bump            [-v major|minor|patch|prerelease] bump version number of all
                  package.json, useful to call this before publishing packages,
                  default is increasing patch number by 1
  flatten-recipe  flattern NPM v2 nodule_modules structure, install-recipe
                  comamnd will execute this command
  test            [-p <package-short-name>] [-f <spec-file-path>] run Jasmine
                  for specific or all packages
  e2e             [-d <test-suit-dir] [-f <spec-file-path>] [--server
                  <start-js-file>] [--dir <working directory>] [--browser
                  <chrome|firefox|ie|opera|edge|safari>]run Jasmine for
                  end-to-end tests
  check-dep       Print out dependency list of all your source code packages
                  (according to `recipeSrcMapping` value in config.yaml), help
                  you to check if there is conflict dependency version

Options:
  -b, --bundle   <bundle-name> if used with command `compile` or `build`, it
                 will only compile specific bundle, which is more efficient
  -p, --package  <package-short-name> if used with command `compile`, `build`,
                 `lint`, it will only build and check style on specific package,
                 which is more efficient
  --only-js      only rebuild JS bundles
  --only-css     only rebuild CSS bundles
  -d             <src foldr> if used with command `link`, it will link packages
                 from specific folder instead of `srcDir` configured in
                 config.yaml
  -r             <recipe foldr> if used with command `link`, it will link
                 packages only to specific recipe folder instead of
                 `recipeFolder` configured in config.yaml
  -v             major | minor | patch | prerelease, used with `bump`
  -f, --file     <file-path> command `gulp test -f specFile1 [-f specFile2] ...`
  --browser      Used with command `e2e`
                         [choices: "firefox", "chrome", "ie", "safari", "opera"]
  --server       <start JS file>, optional, used with command `e2e`,
                 automatically start test server
  --dir          <working directory>, optional, used with command `e2e`,
                 indicates which directory as test server start directory
  -h, --help     Show help                                             [boolean]

```
