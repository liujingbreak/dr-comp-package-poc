{% if packageNameAvailable %}var __api = drApi('{{packageName}}', '{{bundle}}');{% endif %}
{{ source }}
