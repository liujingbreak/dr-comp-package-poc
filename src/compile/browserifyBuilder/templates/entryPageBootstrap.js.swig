require('@dr-core/labjs');
window.$LAB{% for jsLink in jsLinks %}
.script('{{ jsLink }}'){% endfor %}.wait(function() {
	require('@dr-core/browserify-builder-api');
	require('{{ entryPackage }}');
});
