## 环境要求
- NodeJS >= 6.5.x
- NPM >= 3.x.x

## Workspace 是当前工作目录, 配置和Node组件的运行容器
自动生成的目录和文件:
```
├─ 
├─ dist/
|	└─ static/
├─ logs/
├─ node_modules/
├─ app.js
├─ config.501.yaml
├─ config.local.yaml
├─ config.npm501.yaml
├─ config.yaml
├─ dr.project.list.json
├─ gulpfile.js
├─ log4js.json
├─ module-resolve.browser.js
├─ module-resolve.server.js
└─ package.json
```
- 每个workspace里面有对应的配置文件: `config.*.yaml`, 这些文件的内容来自每个组件的`package.json` `dr.config`的属性.
不同的环境可以配置多套配置文件, 在运行Node服务器时, 用参数指定配置文件.
- `module-resolve.*.js` 用来配置依赖别名, 依赖替换, 比如将指定组件对`jquery`的依赖替换为`zepto`.

## 生产环境多个Workspace
对不同的终端客户群, 终端访问设备分不同的workspace

## 多个Workspace 共用node_modules
创建新的workspace目录可以不用`npm install`, 创建一个symbolic link到之前的workspace/node_modules是最省力的方式
```
cd workspace2/node_modules
ln -s ../../workspace/node_modules node_modules
```


