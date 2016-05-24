var Path = require('path');
var log = require('@dr/logger').getLogger(Path.basename(__filename, '.js'));
var helper = require('@dr/e2etest-helper');
var config = require('@dr/environment').config;
// var _ = require('lodash');
var request = require('request');

describe('example-browserify', ()=> {
	helper.setup();
	beforeAll(helper.waitForServer);

	it('resource file in assets can be access', (done)=> {
		request('http://localhost:' + config().port + '/example-browserify/resource.json', (error, response, body)=> {
			if (error) {
				log.error(error);
				return done.fail(error);
			}
			expect(response.statusCode).toBe(200);
			done();
		});
	});
});
