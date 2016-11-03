var es = require('esprima');
var walk = require('esprima-walk');
var log = require('log4js').getLogger('translate-generator.jsParser');
var _ = require('lodash');
var api = require('__api');

var matchFuncNames = [
	'$translate',
	'$translate.instant'
];

module.exports = function(fileContent, onKeyFound) {
	var configNames = api.config.get(api.packageShortName + '.scanMethodNames');
	if (configNames) {
		[].push.apply(matchFuncNames, [].concat(configNames));
	}
	var ast = es.parse(fileContent, {
		loc: true,
		range: true
	});

	var matchAsts = matchFuncNames.map(name => {
		return es.parse(name).body[0].expression;
	});

	walk(ast, node => {
		if (node.type === 'CallExpression') {
			matchAsts.some(matchAst => {
				if (isSameAst(matchAst, node.callee)) {
					if (!node.arguments || node.arguments.length === 0) {
						log.warn('Should call with at least 1 parameter, ' + 'line ' + node.loc.start.line +
						':\n' + fileContent.substring(node.range[0], node.range[1]));
						return true;
					}
					var keyParam = node.arguments[0];
					if (keyParam.type !== 'Literal') {
						log.warn('Should be String literal param type, ' + 'line ' + keyParam.loc.start.line +
							':\n' + fileContent.substring(node.range[0], node.range[1]));
						return true;
					}
					log.debug('found key in JS: ' + node.arguments[0].value);
					onKeyFound(node.arguments[0].value);
					return true;
				}
				return false;
			});
		}
	});
};
module.exports.isSameAst = isSameAst;
/**
 * Deep comparison
 * @return true if node2 has all the properties and their values same as node1 has
 */
function isSameAst(node1, node2) {
	return _.every(node1, (value, key) => {
		if (!{}.hasOwnProperty.call(node2, key)) {
			return false;
		}
		if (_.isObject(value)) {
			return isSameAst(value, node2[key]);
		} else if (_.isArray(value)) {
			return _.isArray(node2[key]) && _.difference(value, node2[key]).length === 0;
		} else if (value !== node2[key]) {
			return false;
		}
		return true;
	});
}
