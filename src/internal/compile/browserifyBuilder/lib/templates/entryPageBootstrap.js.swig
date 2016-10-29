(function() {
	require('@dr-core/labjs');
	var bl = require('@dr-core/bundle-loader');
{% if cssPaths %}
	bl.loadCssBundles({{ cssPaths }}, '{{ staticAssetsURL }}');
{% endif %}
	var jsPaths = {{ jsPaths }};
	bl.runJsBundles(jsPaths, '{{ staticAssetsURL }}', '{{ entryPackage }}', {{ data }}, {{ debug }}, window.onWfhReady)
})();
