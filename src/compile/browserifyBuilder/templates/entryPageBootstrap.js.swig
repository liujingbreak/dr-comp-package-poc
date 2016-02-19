require('@dr-core/labjs');
window.$LAB
.setGlobalDefaults({ {% if debug %}Debug:true{% endif %} }){% for jsLink in jsLinks %}
.script('{{ jsLink }}'){% endfor %}.wait(function() {
	try{
		require('@dr-core/browserify-builder-api');
		require('{{ entryPackage }}');
	}catch(err){
		console.error(err.stack);
	}
});
