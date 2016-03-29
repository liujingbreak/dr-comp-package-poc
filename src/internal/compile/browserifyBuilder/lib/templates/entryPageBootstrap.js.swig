require('@dr-core/labjs');
(function(){
	var bundles = [{% for jsLink in jsLinks %}{% if !loop.first %},{% endif %}'{{ jsLink }}'{% endfor %}];
	window.$LAB
	.setGlobalDefaults({ {% if debug %}Debug:true{% endif %} })
	.script(bundles).wait(function() {
		try{
			drApi = require('@dr-core/browserify-builder-api');
			drApi._config = {
				staticAssetsURL:{{staticAssetsURL}},
				serverURL:{{serverURL}},
				packageContextPathMapping:{{packageContextPathMapping}}
			};
			require('{{ entryPackage }}');
		}catch(err){
			console.error(err.stack);
		}
	});
})();
