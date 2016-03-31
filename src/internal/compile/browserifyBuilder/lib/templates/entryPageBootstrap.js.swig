require('@dr-core/labjs');
(function(){
	var bundles = [{% for jsLink in jsLinks %}{% if !loop.first %},{% endif %}'{{ jsLink }}'{% endfor %}];
	window.$LAB
	.setGlobalDefaults({ {% if debug %}Debug:true{% endif %} })
	.script(bundles).wait(function() {
		drApi = require('@dr-core/browserify-builder-api');
		drApi.setup({{data}});
		require('{{ entryPackage }}');
	});
})();
