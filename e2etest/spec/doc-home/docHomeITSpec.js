var Path = require('path');
var log = require('@dr/logger').getLogger('test.' + Path.basename(__filename, '.js'));
var helper = require('@dr/e2etest-helper');
var docHomePage = require('../../pages/docHomePage');
var _ = require('lodash');
var Promise = require('bluebird');

describe('When server is started', function() {
	helper.setup();

	it('the home page should be available', function(done) {
		Promise.coroutine(function*() {
			yield docHomePage.get();
			expect(docHomePage.faviconStatus).toBe(200);
			yield Promise.delay(1000);
			var url = yield helper.driver.getCurrentUrl();
			log.info('current url: ' + url);
			expect(_.endsWith(url, '#/')).toBe(true);
			yield Promise.delay(1500);
			helper.saveScreen('doc-home.png');
			done();
		})()
		.catch(e => {
			log.error(e);
			done.fail(e);
		});
	});
});
