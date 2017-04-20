var esParser = require('../lib/esParser');
var Path = require('path');
var fs = require('fs');


describe('esParser', () => {
	xit('should recoganize __api reference', () => {
		esParser.parse(fs.readFileSync(Path.resolve(__dirname, 'resource', 'sampleApiCallJs.js')));
	});

	it('should recoganize require.ensure()', () => {
		var handler = jasmine.createSpyObj('handler', ['splitLoad']);
		esParser.parse(fs.readFileSync(
				Path.resolve(__dirname, 'resource', 'sampleRequireEnsure.js')),
			handler);
		expect(handler.splitLoad.calls.allArgs()).toEqual([
			['a'],
			['b'],
			['e'],
			['f'],
			['g']
		]);
		console.log(handler.splitLoad.calls.allArgs());
	});

	it('replaceRequireKeyword() should recoganize require keyword in call expression and identity expression', () => {
		var replaced = esParser.replaceRequireKeyword('require("s");require("b");typeof require', 'X');
		expect(replaced).toEqual('X("s");X("b");typeof X');

		replaced = esParser.replaceRequireKeyword('foo.require("s");require("b");require = 5;bar[require]', 'X');
		expect(replaced).toEqual('foo.require("s");X("b");X = 5;bar[X]');

		replaced = esParser.replaceRequireKeyword('require.ensure("s")', 'X');
		expect(replaced).toEqual('X.ensure("s")');

		var sample = 'foo({require: null})';
		replaced = esParser.replaceRequireKeyword(sample, 'X');
		expect(replaced).toEqual(sample);
	});
});
