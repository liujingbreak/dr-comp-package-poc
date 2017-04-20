var acorn = require('acorn');
var _ = require('lodash');
var estraverse = require('estraverse-fb');
var acornjsx = require('acorn-jsx/inject')(acorn);

exports.parse = parse;

/**
 * [parse description]
 * @param  {string} text    [description]
 * @param  {object} handler {
 * @param  {function} handler.splitLoad(packageName)
 * @param  {function} handler.apiIndentity(astNode)
 * @param  ast: AST, if not null, it will skip acorn parsing
 */
function parse(text, handler, ast) {
	if (_.startsWith(text, '#!')) {
		text = text.substring(text.indexOf('\n'));
	}
	if (!ast) {
		try {
			ast = acornjsx.parse(text, {ranges: true, allowHashBang: true, plugins: {jsx: true}});
		} catch (err) {
			ast = acornjsx.parse(text, {ranges: true, allowHashBang: true, plugins: {jsx: true},
				sourceType: 'module'});
		}
	}
	//console.log('\n---------\n%s', JSON.stringify(ast, null, '  '));
	estraverse.traverse(ast, {
		enter: function(node, parent) {
			if (onIdentity('__api', node, parent)) {
				handler.apiIndentity(node);
			} else if (node.type === 'CallExpression') {
				if (handler.requireApi && node.callee && node.callee.type === 'Identifier' && node.callee.name === 'require' && _.get(node, 'arguments[0].value') === '__api') {
					handler.requireApi();
				} else if (node.callee && node.callee.type === 'MemberExpression' &&
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

exports.onIdentity = onIdentity;
function onIdentity(name, node, parent) {
	return (node.type === 'Identifier' && node.name === name && !(parent.type === 'MemberExpression' && parent.property === node));
}

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
