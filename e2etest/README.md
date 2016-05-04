End-to-end Test
==========
### Test Spec directory

Any file in `<project-root>/e2etest/spec` is considered as test spec file.

Ideally you should group your test specs in subdirectories like:

```
<project-root>
	└── e2etest
			└── spec
				├── logingroup
				|   ├── login_test.js
				|   └── otherlogin_test.js
				├── addressbook
				|   ├── addressbook_test.js
				|   └── contact_test.js
				├── chat
				|   ├── chatwindow_test.js
				|   ├── chatmessage_test.js
				|   └── otherchat_test.js
				└── smoketests
				├── smoke_test.js
				└── othersmoke_test.js

```

### Configure your test environment
Currently **Nightwatch** is used as our end-to-end test framework.

`<web-fun-house-root-dir>/e2etest/Nightwatch.json` is internal default Nightwatch setting.
Overridden setting is read from `<project-root>/config.yaml` and `config.local.yaml`

So, if you want to override local chrome driver file location setting, in your `config.yaml` or `config.local.yaml`, you add following lines:
```yaml
e2etest:
    selenium:
        cli_args:
            webdriver.chrome.driver: "../chromedriver"

```
### Download selenium server
If you can access our private NPM server, simply do:

```
npm install @dr/selenium-server-wrap
```

Otherwise,
- download `selenium-server-standalone-{version}.jar` from [http://selenium-release.storage.googleapis.com/index.html](http://selenium-release.storage.googleapis.com/index.html)

- Configure config.yaml or config.local.yaml
```yaml
e2etest:
    selenium:
		server_path: "<your downloaded selenium server location>"
```


### Run test
Run test in Firefox
```
gulp e2e
```
In Chrome (You need to download Chrome driver and config its location in config.yaml)
```
gulp e2e --chrome
```
