var webdriver = require('selenium-webdriver');
var config = require('@dr/environment').config;
var Path = require('path');
var _ = require('lodash');
var log = require('@dr/logger').getLogger(Path.basename(__filename));
var request = require('request');

process.env.PATH = process.env.PATH + ':' + Path.resolve(config().e2etest.selenium.driverPath);

var driver;
var browser = 'firefox'; // default is firefox

// lazy restart webdriver and make it singleton
Object.defineProperty(exports, 'driver', {
	enumerable: true,
	configurable: true,
	get: function() {
		if (!driver) {
			log.info('Browser: ' + browser);
			driver = new webdriver.Builder().forBrowser(browser).build();
		}
		return driver;
	}
});
exports.driver = driver;
exports.basePage = require('./basePage');

exports.setup = function() {
	beforeAll(startup);
	afterAll(teardown);
};

exports.statusCodeOf = function(path) {
	return new Promise((resolve, reject) => {
		if (!_.startsWith(path, '/')) {
			path = '/' + path;
		}
		request('http://localhost:' + config().port + path, (error, response, body)=> {
			if (error) {
				log.error(error);
				return reject(error);
			}
			resolve(response.statusCode);
		});
	});
};

function startup() {
	jasmine.DEFAULT_TIMEOUT_INTERVAL = 10 * 1000;
}

function teardown(done) {
	if (driver) {
		log.info('driver close');
		return driver.close()
		.then(_.bind(driver.quit, driver))
		.finally(()=> {
			driver = null;
			done();
		});
	} else {
		done();
	}
}

exports.setBrowser = function(name) {
	log.debug('set browser ' + name);
	name = name ? name : 'firefox';
	browser = name;
};

exports.waitForServer = waitForServer;

function waitForServer(done) {
	var tryCount = 0;
	log.debug('wait for server starting');//setTimeout(done, 5000);
	tryConnectServer(done);

	function tryConnectServer(done) {
		if (tryCount > 10) {
			return;
		}
		tryCount++;
		log.debug('try to connect to server for times: ' + tryCount);
		setTimeout(()=> {
			request('http://localhost:' + config().port, (error, response, body) => {
				if (error) {
					if (error.code === 'ECONNREFUSED') {
						tryConnectServer(done);
					} else {
						log.error(error);
						done.fail('Server is not available');
						return;
					}
				} else {
					done();
				}
				if (response) {
					log.debug(response.statusCode);
				}
			});
		}, 1000);
	}
}
