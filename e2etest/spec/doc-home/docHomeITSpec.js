var Path = require('path');
var log = require('@dr/logger').getLogger('test.' + Path.basename(__filename, '.js'));
var helper = require('@dr/e2etest-helper');
var docHomePage = require('../../pages/docHomePage');
var _ = require('lodash');

describe('When server is started', function() {
	helper.setup();

	it('the home page should be available', function(done) {
		docHomePage.get().then(() => {
			log.debug('get done');
			expect(docHomePage.faviconStatus).toBe(200);
			return new Promise(resolve => {
				setTimeout(()=> {
					helper.driver.getCurrentUrl().then(resolve);
				}, 1000);
			});
		})
		.then(url => {
			log.debug('current url: ' + url);
			expect(_.endsWith(url, '/doc-home/index.html#/')).toBe(true);
			return new Promise((resolve)=> {
				setTimeout(resolve, 2000);
			}).then(() => {
				helper.saveScreen('doc-home.png');
			});
		})
		.then(done)
		.catch(e => {
			log.error(e);
			done.fail(e);
		});
	});
});
