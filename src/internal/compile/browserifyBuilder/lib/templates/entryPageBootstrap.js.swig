require('@dr-core/labjs');
(function(){
	var jsPaths = {{ jsPaths }}
	var bundles = []
	for(var i=0,l=jsPaths.length;i<l;i++){
		bundles.push('{{ staticAssetsURL }}/'+jsPaths[i]);
	}
	window.$LAB
	.setGlobalDefaults({ {% if debug %}Debug:true{% endif %} })
	.script(bundles).wait(function() {
		try {
			drApi = require('@dr-core/browserify-builder-api');
			drApi.setup({{data}});
			drApi.setup({loadedBundles: bundles});
			require('{{ entryPackage }}');
		}catch(e){
			if(console) console.error(e.stack);
		}
	});
})();
