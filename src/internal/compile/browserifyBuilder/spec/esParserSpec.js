var esParser = require('../lib/esParser');
var Path = require('path');
var fs = require('fs');


describe('esParser', ()=> {
	xit('should recoganize __api reference', ()=> {
		esParser.parse(fs.readFileSync(Path.resolve(__dirname, 'resource', 'sampleApiCallJs.js')));
	});

	it('should recoganize require.ensure()', ()=> {
		var handler = jasmine.createSpyObj('handler', ['splitLoad']);
		esParser.parse(fs.readFileSync(
			Path.resolve(__dirname, 'resource', 'sampleRequireEnsure.js')),
			handler);
		expect(handler.splitLoad.calls.allArgs()).toEqual([[ 'a' ], [ 'b' ], [ 'e' ], [ 'f' ], ['g']]);
		console.log(handler.splitLoad.calls.allArgs());
	});
});
