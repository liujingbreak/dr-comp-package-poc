@dr web platform command tool
===========
## Directories

- ### Project directory
  Which is your local cloned git repository folder 
  ```
  <project directory>
    |- src
    |- .gitignore
    |- e2etest
    |- ...
    
  ```

- ### Workspace directory
  An empty folder at beginning, where we will install or link all components to and put configuration files in later on.

  The `process.cwd()` directory where we pack web resource and run Node sever.
  ```
  <workspace directory>
    |- node_modules/
    |- config.yaml
    |- logs/
    |- package.json
    |- ....
  ```

- ### Src directory
  `<project directory>/src`, holds components source code.

- ### End-to-end test directory
  `<project directory>/e2etest`

## Create local workspace

1. Install command line tool, create an empty **container** folder in somewhere.

  ```shell
  npm install -g dr-comp-package-cli # Only need to install once

  mkdir dr-workspace
  cd dr-workspace
  npm install dr-comp-package
  wfh add <project1-dir> <project2-dir> ...
  npm install
  # For development mode, compile web static resource to memory and start node web server
  node app
  # For production mode, compile web static resource to dist/
  gulp compile
  ```
  It creates files: `package.json`, `config.yaml`, `config.local.yaml`, ...
  And folders

 ## Component configuration property
 In each component's package.json file
 ```json
 {
   ...
   "dr": {
      "chunk": "chunkName",
      "entryPage": "*-index.html", // Could be glob format path or array like ["index.html", "other.html"]
      "entryView": "home-view.html", // Node rendering view file
      "compiler": "webpack", // Must be set
      "outputPath": "", 
      // Consider it as Webpack's `output.path` setting, but only affects entry page path,
      // and it is relative to global `output.path`, empty string meaning it is output to root directory of
      // `dist/static`
      "config": { // default setting which will be added up to <workspace>/config.yaml
          "public": {
              // Exposed to Browser by `webpack.DefinePlugin`,
              // it can be programmatically accessed from both NodeJS and Browser side API:
              //    `api.config()[api.packageName]anyCustomizedProperty' and `api.config()[api.packageName].hierarchicalProperty.childProperty`
              // or lodash.get() like format `api.config.get(api.packageName + '.hierarchicalProperty.childProperty', 'defaultValue')
            "anyCustomizedProperty": "anyTypeValue",
            "hierarchicalProperty": {
                "childProperty": ["complexTypeValue"]
            }
          },
          "server": { // Same as "config", but it can only be accessed by NodeJS program, not Browser side program,
              // Stuff like DB connection password kind sensitive data, you would not want them to be
              // exposed to Browser side
            "dbUser": "admin",
            "dbPass": "dontTellOthers"
          }
      },
      "config.local": {"public": {}, "server": {}}, // Settings which will be added up to <workspace>/config.local.yaml
      "config.demo": {"public": {}, "server": {}} // Settings which will be added up to <workspace>/config.demo.yaml
      // Any property in form of "config.<environment>"
     }
 }

 ```

 ## Module resolve
 Like Webpack configuration `module.resolve`, we have even more fine-grained resolve control files:
 - `module-resolve.browser.js`
 - `module-resolve.server.js`
 
 We even supports NodeJS side module resolve.

 > Originally in dr-comp-package v0.9.x they are named as `inject.js` and `browserify-inject.js`.

## Share same `node_modules` with multiple work space directories

Create workspace directory 1 like normal, do `wfh init` in that directory. Then later on, create workspace directory 2, but create a symbolic link to workspace 1's folder `node_modules`. 

We will need more than on work space to have different configurations.
For example, one workspace for responsive web projects which runs for all kinds of browser, and another workspace for advance projects which only support mobile browser. 

We can have different configuration like resolving setting, in workspace module `$` should be resolved to jQuery 1.x, but for workspace 2, it should be Zepto. Also chunk setting are probably different for 2 workspaces.

So that we can optimize our bundle and library for different client but also reuse common component as much as possible.


