var jsParser = require('../jsParser');
var es = require('esprima');
var log = require('log4js').getLogger(__filename);

describe('jsParser', function() {
	describe('.isSameAst()', function() {
		it('shoud work for comparing 2 esprima memberExpression nodes', function() {
			var node1 = es.parse('$translate.instant').body[0].expression;
			var node2 = es.parse('$translate.instant("something")').body[0].expression.callee;
			log.debug(JSON.stringify(node1, null, ' '));
			log.debug(JSON.stringify(node2, null, ' '));
			expect(jsParser.isSameAst(node1, node2)).toBeTruthy();
		});

		it('shoud work for comparing 2 array values', function() {
			var node1 = [1,2,3];
			var node2 = [1,2,3];
			expect(jsParser.isSameAst(node1, node2)).toBeTruthy();
		});
	});
});
