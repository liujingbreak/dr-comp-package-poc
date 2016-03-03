Quick Start
---------
### 如果你是平台开发者


1.	你可以使用办公室内的Sinopia server, [http://10.9.14.9:4873](http://10.9.14.9:4873)
	```shell
	npm set registry http://10.9.14.9:4873
	```
	跳过一下第1步。

	但是如果你非要安装一个本地Sinopia (private NPM registry):

	```shell
	npm install -g sinopia
	```

	启动本地Sinopia

	```shell
	sinopia
	```

	现在尝试访问本地NPM registry [http://localhost:4873/](http://localhost:4873/)

2.	git clone 平台源码

	编辑根目录下`.npmrc`文件,
	将NPM registry指向你所使用的server地址, 比如`http://10.9.14.9:4873`
	```shell
	registry = http://10.9.14.9:4873/
	```

	执行在项目根目录下执行以下命令,
	> 第一次 `gulp build` 可能会执行较长时间

	```shell
	npm install
	gulp build
	npm start

	```

	然后浏览器访问 [http://localhost:14333](http://localhost:14333)
	如果你可以看到一个正常主页，就成功了

	> 你可以管理你的profile level npmrc设置 by `npm set registry http://localhost:4873/`
	>
	> Another cool way is to use `nrm` to switch your NPM registry endpoint. （`npm install nrm`)

3.	尝试在本地Sinopia发布packages, 如果你没有安装本地Sinopia，请跳过此步

	```shell
	npm set registry http://localhost:4873/
	npm adduser <your user name>
	# If you modified anything, bump version before publish
	gulp publish
	```
