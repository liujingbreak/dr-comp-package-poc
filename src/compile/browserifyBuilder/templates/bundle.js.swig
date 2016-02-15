function {{requireFilesFuncName}}() {
	{% for packageIns in packageInstances %}require('{{ packageIns.longName }}');
	{% endfor %}
}
