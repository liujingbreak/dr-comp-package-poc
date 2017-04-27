# dr-comp-package Dianrong内部贡献者开发说明

## 加入Github
  将github id告诉 jing.liu.FE@dianrong.com, 接受邀请加入
 [https://github.com/dr-web-house](https://github.com/dr-web-house)

 加入 [Slack 点融 clients](https://dianrongclients.slack.com) 的Channel #npm-dianrong-com

### dr-comp-package的组成
- 全局命令行 dr-comp-package-cli
- 核心dr-comp-package
- 核心组件群, dr-comp-package是插件模式, 本身需要其他核心的一些组件配合工作
 
#### 核心dr-comp-package源码
[https://github.com/dr-web-house/web-fun-house/wfh](https://github.com/dr-web-house/web-fun-house/wfh)
`master`分支通常会比较outdated, `wip`分支才是开发合并分支.

#### 核心组件群源码
[https://github.com/dr-web-house/web-fun-house/src/internal](https://github.com/dr-web-house/web-fun-house/src/internal)


> 贡献新的feature请告知LJ, 我们会在
[JIRA](https://issue.dianrong.com/secure/RapidBoard.jspa?rapidView=63&projectKey=FE&view=planning&selectedIssue=FE-735)
添加相应的user story, 方便track你的贡献消耗的工时.

- 请基于`wip` 创建新的feature branch, 在这个branch上开发, push你的feature branch后, 请创建一个`pull request`到`wip`分支.
- 执行 `drcp lint --pj ../web-fun-house`

## 开发dr-comp-package模式
为了更方便的看到实时修改dr-comp-package源码立即更新的效果, 内部开发模式和普通使用dr-comp-package开发项目有所不同.

### 1. git clone web-fun-house 项目
```
git clone https://github.com/dr-web-house/web-fun-house.git
```

### 2. 第一次设置你的npm环境
```
npm set registry http://npm.dianrong.com
npm install -g dr-comp-package-cli
```
> 你也可以用`nrm`来切换多个npm server

### 3. 创建你的workspace空目录, 在workspace中执行安装命令
安装完后, 将`<workspace>/node_modules/dr-comp-package`删除,
在node_modules里创建一个symobilic link 名为dr-comp-package, 并关联到`../../web-fun-house/wfh` (假设 web-fun-house的目录和workspace是平级的目录)
```
npm install dr-comp-package
rm -r node_modules/dr-comp-package
cd node_modules
ln -s ../../web-fun-house/wfh dr-comp-package
```

### 4. 回到workspace目录, 和普通开发一样, 关联多个项目, 但是其中需要关联web-fun-house

```
cd <workspace>
drcp project -a ../web-fun-house -a ../my-another-project-folder
# Install more updated depedencies
npm install
# Have a cup of tea
node app --ww -p <your entry component package short name>
# Rock'and roll
```

### 5. Bump package.json version
修改到核心组件和dr-comp-package等的代码后, 需要bump相应的package.json里面version, 请按照semver的方式递增版本号, 增加patch号用于修复bug和一切兼容改动, 增加minor号用于新功能增加.

还需要修改`web-fun-house/recipes/internal-recipe`的版本号, 之后执行`drcp init`以同步recipe中的依赖版本号, 最简单的方式用drcp bump 命令:
```
drcp bump -d ../web-fun-house/recipes/internal-recipe -d ../web-fun-house/src/internal/<changed component dir>
drcp init
# Go to project web-fun-house's dir, do git commit
```
如果你的改动是web-fun-house/wfh, 也需要bump version
```
drcp bump -d ../web-fun-house/wfh 
```

### 6. 修改源码后请执行 `drcp lint`检查代码风格
web-fun-house 目录下有两个文件 `.jscrc`, `.jshintrc`, 请将它们设为你的编辑器JSHint, JSCS插件的项目风格配置文件.

代码提交前, 请执行检查代码风格
```
drcp lint --pj ../web-fun-house
```


