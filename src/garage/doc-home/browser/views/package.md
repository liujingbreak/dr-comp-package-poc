@dr package 目录结构
```
├─ browser/
|	├─ js
|	├─ less
|	└─ views 	(html pages/templates)
|		
├─ server/
|	├─ js 		(NodeJs file)
|	└─ views 	(server rendered pages/templates)
|
├─ assets/  		(images...)
├─ spec/			(test file)
├─ README.md
└─ package.json
```

@dr package 可以在package.json里表明依赖第三方node package
> 在同一个workspace中的客户端组件的第三方依赖的版本需要保持一致
 例如
```json
"dependencies": {
  "lodash": "^3.10.1"
}
```
@dr package 的名字都带有scope `@dr` 或者 `@dr-core`, 例如 package.json:
```json
{
  "name": "@dr/doc-home",
  "version": "0.0.1",
  "description": "Home page",
  "browser": "browser/js/index.js",
  "main": "server/server.js",
  "dr": {
      "chunk": "home",
      "entryPage": "*.html",
      "compiler": "webpack",
	  "outputPath": "",
	  "jsLoader": "babel",
      "config": {
          "public": {
            "anyCustomizedProperty": "anyTypeValue",
            "hierarchicalProperty": {
                "childProperty": ["complexTypeValue"]
            }
          },
          "server": {
            "dbUser": "admin",
            "dbPass": "dontTellOthers"
          }
      },
      "config.local": {"public": {}, "server": {}},
      "config.demo": {"public": {}, "server": {}}
  },
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "author": "LJ",
  "license": "ISC"
}

```
