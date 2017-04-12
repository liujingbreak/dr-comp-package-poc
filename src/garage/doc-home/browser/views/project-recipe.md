### 项目
Git repository管理下的源码目录
目录结构
```
├─ src/
|	├─ component-a/
|	├─ component-b/
|	└─ sub-dir/
|		├─ component-c/
|		└─ ...
├─ recipes/  		(自动创建)
|	└─ .../package.json
|
├─ e2etest/			(test file)
├─ README.md
└─ .gitignore...
```
`src`是必须的文件夹, `recipes` 是组件组如果没有会自动创建.
`drcp init`会修改git-hook, 添加`lint`命令.

### 组件组
组件群是名为`@dr/<name>-recipe`形式的空node package, package.json里面`dependencies`关联了一组组件包，
一般那些之间有关联和依赖的组件，或者就是同一个项目下的组件，方便安装时不用单独一个个安装组件包。
