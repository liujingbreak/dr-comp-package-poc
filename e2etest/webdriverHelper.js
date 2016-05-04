var webdriver = require('selenium-webdriver');
var By = webdriver.By;
var until = webdriver.until;
var config = require('../lib/config');
var Path = require('path');
var _ = require('lodash');

process.env.PATH = process.env.PATH + ':' + Path.dirname(Path.resolve(config().e2etest.selenium.chromeDriver));
console.log(process.env.PATH);
require('selenium-webdriver/chrome');

var driver = new webdriver.Builder()
	.forBrowser('chrome')
    .build();

exports.driver = driver;

exports.startup = function(done) {
	jasmine.DEFAULT_TIMEOUT_INTERVAL = 10 * 1000;
	if (done) {
		done();
	}
	return Promise.resolve();
};

exports.teardown = function(done) {
	return driver.close()
	.then(_.bind(driver.quit, driver))
	.finally(done ? done : ()=> {});
};

exports.setup = function() {
	beforeAll(exports.startup);
	afterAll(exports.teardown);
};
