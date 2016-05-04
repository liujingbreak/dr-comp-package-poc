var Path = require('path');
var log = require('@dr/logger').getLogger(Path.basename(__filename, '.js'));
var helper = require('../../webdriverHelper');
var driver = helper.driver;
var docHomePage = require('../../pages/docHomePage');
//var _ = require('lodash');

describe('When server is started', function() {
	helper.setup();

	it('the home page should be available', function(done) {
		docHomePage.get();
		driver.sleep(200).then(() => {
			return driver.getCurrentUrl();
		})
		.then(url => {
			log.debug(url);
		});

		driver.getPageSource().then(source => {
			log.debug(source);
			return driver.manage().getCookies();
		})
		.then(cookies => {
			log.debug(cookies);
			return driver.getCurrentUrl();
		})
		.then(url => {
			log.debug('current url: ' + url);
		})
		.then(done);
		//driver.waitForElementVisible('body');
	});

});
