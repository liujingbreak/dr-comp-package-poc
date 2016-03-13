var esprima = require('esprima');
var fs = require('fs');
var _ = require('lodash');

module.exports = {
	changeDep: changeDep
};

function changeDep(file, path, json) {
	var text = fs.readFileSync(file, 'utf8');
	var ast = esprima.parse('var json=' + text, {range: true});
	var objT = ast.body[0].declarations[0].init;

	var names = path.split('.');

	names.forEach(function(namePart) {
		var p = lookProperty(objT, namePart);
		objT = p.value;
	});

	return objT;
}

function lookProperty(ast, name) {
	var pNode;
	if (ast.properties == null) {
		console.log(ast);
	}
	ast.properties.some(function(prop) {
		if (prop.type === 'Property' && prop.key.value === name) {
			pNode = prop;
			return true;
		}
	});
	return pNode;
}
