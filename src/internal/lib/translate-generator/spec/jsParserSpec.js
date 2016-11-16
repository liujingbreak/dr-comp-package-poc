var jsParser = require('../jsParser');
var acorn = require('acorn');
var log = require('log4js').getLogger(__filename);

describe('jsParser', function() {
	describe('.isSameAst()', function() {
		it('shoud work for comparing 2 acorn memberExpression nodes', function() {
			var node1 = acorn.parse('$translate.instant').body[0].expression;
			var node2 = acorn.parse('\n $translate.instant("something")', {locations: true}).body[0].expression.callee;
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

	it('should parse JS properly', () => {
		var onKeyFound = jasmine.createSpy('onKeyFound');

		jsParser('drTranslate("key");  drTranslate("key2");  drTranslate("key3");', onKeyFound);
		expect(onKeyFound.calls.count()).toEqual(3);
		expect(onKeyFound).toHaveBeenCalledWith('key', jasmine.any(Object));
		expect(onKeyFound).toHaveBeenCalledWith('key2', jasmine.any(Object));
		expect(onKeyFound).toHaveBeenCalledWith('key3', jasmine.any(Object));
	});

	it('should parse JS properly 2', () => {
		var onKeyFound = jasmine.createSpy('onKeyFound');

		jsParser('a.t("key");  a.$translate("key2");  a.$translate.instant("key3");', onKeyFound);
		expect(onKeyFound.calls.count()).toEqual(0);
	});
});
