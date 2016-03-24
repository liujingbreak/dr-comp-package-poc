Updates
==========

#### 2016-3-25
- 每个package支持多个Entry页面，\
	package.json内的 "`dr`"."`entryView`" 或"`dr`"."`entryPage`"可以是array类型

- 更新Introduction文档\
	增加静态资源的描述
	#### Static Assets URL
	静态资源文件放入`packageRootDir/assets` 目录,
	用`assets://<package-name>` 引用

	```less
	.some-selector {
		background-image: url(assests://@dr/my-package/background.jpg);
	}
	.some-equivalent {
		background-image: url("assests://@dr/my-package/background.jpg");
		background-image: url('assests://@dr/my-package/background.jpg');
	}

	```
