var acorn = require('acorn');
var acornjsx = require('acorn-jsx/inject')(acorn);
var estraverse = require('estraverse-fb');
var log = require('log4js').getLogger('translate-generator.jsParser');
var _ = require('lodash');
var api = require('__api');

var matchFuncNames = [];

module.exports = function(fileContent, onCallExpNode, filePath, ast) {
	var configNames = api.config.get(api.packageName + '.scanMethodNames');
	if (configNames) {
		[].push.apply(matchFuncNames, [].concat(configNames));
	}
	if (!ast) {
		try {
			ast = acornjsx.parse(fileContent, {locations: true, allowHashBang: true, plugins: {jsx: true}});
		} catch (err) {
			ast = acornjsx.parse(fileContent, {locations: true, allowHashBang: true, plugins: {jsx: true},
				sourceType: 'module'});
		}
	}

	var matchAsts = matchFuncNames.map(name => {
		return acorn.parse(name).body[0].expression;
	});

	estraverse.traverse(ast, {
		enter: function(node, parent) {
			if (node.type === 'CallExpression') {
				matchAsts.some(matchAst => {
					if (isSameAst(matchAst, node.callee)) {
						if (!node.arguments || node.arguments.length === 0) {
							log.warn('%s\nShould call with at least 1 parameter, ' + 'line ' + node.loc.start.line +
							':\n' + fileContent.substring(node.start, node.end), filePath);
							return true;
						}
						var keyParam = node.arguments[0];
						if (keyParam.type !== 'Literal') {
							log.warn('%s\nShould be String literal param type, ' + 'line ' + keyParam.loc.start.line +
								':\n' + fileContent.substring(node.start, node.end), filePath);
							return true;
						}
						log.debug('found key in JS: ' + node.arguments[0].value);
						onCallExpNode(node.arguments[0].value, node);
						return true;
					}
					return false;
				});
			}
		}
	});
};

var compareIngoreProperty = {loc: true, start: true, end: true};

module.exports.isSameAst = isSameAst;
/**
 * Deep comparison
 * @return true if node2 has all the properties and their values same as node1 has
 */
function isSameAst(node1, node2) {
	return _.every(node1, (value, key) => {
		if (_.has(compareIngoreProperty, key))
			return true;
		if (!_.has(node2, key)) {
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
