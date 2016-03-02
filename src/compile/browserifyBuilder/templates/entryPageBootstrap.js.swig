require('@dr-core/labjs');
window.$LAB
.setGlobalDefaults({ {% if debug %}Debug:true{% endif %} }){% for jsLink in jsLinks %}
.script('{{ jsLink }}'){% endfor %}.wait(function() {
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
