require('@dr-core/labjs');
(function() {
	var jsPaths = {{ jsPaths }};
	if (typeof(__EXTERNAL_JS) !== 'undefined')
		jsPath.push.apply(jsPath, __EXTERNAL_JS);
	var bundles = [], prefix, jsPath;
	for (var i = 0, l = jsPaths.length; i < l; i++) {
		jsPath = jsPaths[i];
		prefix = (jsPath.charAt(0) === '/' ||
			(jsPath.length >= 7 &&
				(jsPath.substring(0, 7) === 'http://' || jsPath.substring(0, 8) === 'https://'))) ?
			'' : '{{ staticAssetsURL }}/';
		bundles.push(prefix + jsPath);
	}
	window.$LAB
	.setGlobalDefaults({ {% if debug %}Debug:true{% endif %} })
	.script(bundles).wait(function() {
		try {
			drApi = require('@dr-core/browserify-builder-api');
			drApi.setup({{ data }});
			drApi.setup({loadedBundles: bundles});
			require('{{ entryPackage }}');
		} catch(e) {
			if(console) console.error(e.stack);
		}
	});
})();
