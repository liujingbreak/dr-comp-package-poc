var Path = require('path');
var log = require('@dr/logger').getLogger(Path.basename(__filename, '.js'));
var helper = require('@dr/e2etest-helper');
var docHomePage = require('../../pages/docHomePage');
var _ = require('lodash');

describe('When server is started', function() {
	helper.setup();

	beforeAll(helper.waitForServer);

	it('the home page should be available', function(done) {
		docHomePage.get().then(() => {
			log.debug('get done');
			expect(docHomePage.faviconStatus).toBe(200);
			return helper.driver.getCurrentUrl();
		})
		.then(url => {
			log.debug(url);
			return helper.driver.getCurrentUrl();
		})
		.then(url => {
			log.debug('current url: ' + url);
			expect(_.endsWith(url, '/doc-home/index.html#/')).toBe(true);
		})
		.then(done)
		.catch(e => {
			log.error(e);
			done.fail(e);
		});
	});
});
