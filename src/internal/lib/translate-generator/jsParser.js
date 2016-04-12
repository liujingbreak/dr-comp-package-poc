var es = require('esprima');
var walk = require('esprima-walk');
var log = require('log4js').getLogger('translate-generator.jsParser');

module.exports = function(config, fileContent, onKeyFound) {
	var ast = es.parse(fileContent, {
		loc: true,
		range: true
	});

	walk(ast, node => {
		if (node.type === 'CallExpression') {
			if (node.callee.type === 'Identifier' && {}.hasOwnProperty.call(funcNames, node.callee.name)) {
				if (!node.arguments || node.arguments.length === 0) {
					log.warn('Should call with at least 1 parameter, ' + 'line ' + node.loc.start.line +
					':\n' + fileContent.substring(node.range[0], node.range[1]));
					return;
				}
				var keyParam = node.arguments[0];
				if (keyParam.type !== 'Literal') {
					log.warn('Should be String literal param type, ' + 'line ' + keyParam.loc.start.line +
						':\n' + fileContent.substring(node.range[0], node.range[1]));
					return;
				}
				log.debug('found key in JS: ' + node.arguments[0].value);
				onKeyFound(node.arguments[0].value);
			}
		}
	});
};

var funcNames = {
	$translate: true
};
