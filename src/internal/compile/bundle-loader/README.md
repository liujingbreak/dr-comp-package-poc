CSS bundle Loader
------------
It works with LABjs to load JS and CSS bundle files at entry page initial time, doesn't depend on any other 3rd-party library.

### Exports

**.loadCssBundles** (paths: string[]) => void

**.runJsBundles** (\
	jsPaths: string[],\
	urlPrefix: string,\
	entryPackageName: string,\
	entryApiData: entryApiDataJson,\
	isDebug: boolean,\
	callback: (err: error) => void\
)
