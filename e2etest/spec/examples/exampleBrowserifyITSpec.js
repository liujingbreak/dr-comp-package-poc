//var Path = require('path');
//var log = require('@dr/logger').getLogger(Path.basename(__filename, '.js'));
var helper = require('@dr/e2etest-helper');
// var _ = require('lodash');

describe('example-browserify', ()=> {
	helper.setup();

	it('resource file in assets can be access', (done)=> {
		helper.statusCodeOf('/example-browserify/resource.json')
		.then(statusCode => {
			expect(statusCode).toBe(200);
			done();
		})
		.catch(e => {
			done.fail(e);
		});
	});
});
