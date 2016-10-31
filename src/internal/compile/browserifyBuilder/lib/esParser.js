var esprima = require('esprima');
var estraverse = require('estraverse');
var _ = require('lodash');

exports.parse = parse;

/**
 * [parse description]
 * @param  {string} text    [description]
 * @param  {object} handler {
 * @param  {function} handler.splitLoad(packageName)
 * @param  {function} handler.Identifier(name)
 */
function parse(text, handler) {
	if (_.startsWith(text, '#!')) {
		text = text.substring(text.indexOf('\n'));
	}
	var ast = esprima.parse(text, {range: true, loc: false});
	//console.log('\n---------\n%s', JSON.stringify(ast, null, '  '));
	estraverse.traverse(ast, {
		enter: function(node, parent) {
			if (node.type === 'CallExpression') {
				if (node.callee && node.callee.type === 'MemberExpression' &&
				node.callee.object.name === 'require' &&
				node.callee.object.type === 'Identifier' &&
				node.callee.property.name === 'ensure' &&
				node.callee.property.type === 'Identifier') {
					var args = node.arguments;
					if (args.length < 2) {
						throw new Error('require.ensure() must be called with 2' +
						'paramters (Array packageNames, Function callback)');
					}
					if (args[0].type === 'ArrayExpression') {
						args[0].elements.forEach(nameNode => {
							if (nameNode.type !== 'Literal') {
								throw new Error('require.ensure() must be called with String literal');
							}
							handler.splitLoad(nameNode.value);
						});
					} else if (args[0].type === 'Literal') {
						handler.splitLoad(args[0].value);
					}
				}
			}
			//parser.handleAstEnter(node, parent);
		},

		leave: function(node, parent) {
			//parser.handleAstLeave(node, parent);
		}
	});
	return ast;
}

var acorn = require('acorn');
var patchText = require('./patch-text');
exports.replaceRequireKeyword = function(code, replacement) {
	var ast = acorn.parse(code);
	var patches = [];
	estraverse.traverse(ast, {
		enter: function(node, parent) {
			if (node.type === 'Identifier' && node.name === 'require' &&
				(parent.type !== 'MemberExpression' || parent.object === node || parent.computed) &&
				(parent.type !== 'Property' || parent.key !== node)) {
				patches.push({
					start: node.start,
					end: node.end,
					replacement: replacement
				});
			}
		}
	});
	return patchText(code, patches);
};
