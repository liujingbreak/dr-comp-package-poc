var Path = require('path');
var log = require('@dr/logger').getLogger('test.' + Path.basename(__filename, '.js'));
var helper = require('@dr/e2etest-helper');
//var webdriver = require('selenium-webdriver');
var pages = require('../../pages/docHomePage');
var docHomePage = pages.docHomePage;
var compStorePage = pages.compStorePage;
var _ = require('lodash');
var Promise = require('bluebird');

describe('When server is started', function() {
	helper.setup();
	beforeAll(() => {
		jasmine.DEFAULT_TIMEOUT_INTERVAL = 20 * 1000;
	});

	it('the home page should be available', function(done) {
		Promise.coroutine(function*() {
			yield docHomePage.get();
			expect(docHomePage.faviconStatus).toBe(200);
			yield Promise.delay(1000);
			var url = yield helper.driver.getCurrentUrl();
			log.info('current url: ' + url);
			expect(_.endsWith(url, '#/')).toBe(true);
			var text = yield docHomePage.el('body').getText();
			log.debug(text);
			//yield Promise.delay(1500);
			//helper.saveScreen('doc-home.png');
			done();
		})()
		.catch(e => {
			log.error(e);
			done.fail(e);
		});
	});

	xit('the component store page should be available', function(done) {
		Promise.coroutine(function*() {
			yield compStorePage.get();
			var allcomp = yield compStorePage.el('group').waitAndFind('comp-card');
			log.debug('There are %d components', allcomp.length);
			expect(allcomp.length > 5).toBe(true);
			var nocomp = yield compStorePage.el('group').waitAndFind('.fuckedup', 1000);
			expect(nocomp.length === 0).toBe(true);
			done();
		})()
		.catch(e => {
			log.error(e);
			done.fail(e);
		});
	});
});
