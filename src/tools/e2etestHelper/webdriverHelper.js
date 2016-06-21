var webdriver = require('selenium-webdriver');
var Path = require('path');
var _ = require('lodash');
var log = require('@dr/logger').getLogger('test.' + Path.basename(__filename));
var request = require('request');
var Promise = require('bluebird');
var fs = require('fs');
var fork = require('child_process').fork;
var basePage = require('./basePage');

var isWindows = process.platform.indexOf('win32') >= 0;
var driver, config, urlPrefix;
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
exports.waitForServer = waitForServer;
exports.waitForServerStart = waitForServerStart;
exports.run = run;

/**
 * @param  {function} theConfig  config object
 * @param  {string} browser
 * @param {string} start server file
 * @param {string} direction in which start server
 * @param  {function} runTest   Start your jasmine test in this callback, must return Promise
 * @return {Promise}
 */
function run(theConfig, browser, serverModule, cwd, runTest) {
	config = theConfig;
	process.env.PATH = process.env.PATH + (isWindows ? ';' : ':') + Path.resolve(config.resolve('e2etestHelper.selenium.driverPath'));
	log.debug(process.env.PATH);
	if (config.get('sl.enabled')) {
		exports.urlPrefix = urlPrefix = 'https://localhost:' + config().ssl.port;
	} else {
		exports.urlPrefix = urlPrefix = 'http://localhost:' + config().port;
	}
	// `basePage` relies on `urlPrefix`
	exports.basePage = basePage;
	basePage.prototype._urlPrefix = urlPrefix;

	setBrowser(browser);
	var serverProcess;
	var serverStopProm = Promise.resolve();
	if (serverModule) {
		serverModule = Path.resolve(serverModule);
		log.info('start server ' + serverModule);
		var workDir = cwd ? Path.resolve(cwd) : process.cwd();
		serverProcess = fork(serverModule, {cwd: workDir});

		serverStopProm = new Promise((resolve, reject) => {
			serverProcess.on('exit', (code, signal) => {
				log.info('server exits with ' + code + '-' + signal);
				resolve();
			});
			serverProcess.on('error', err => {
				log.error(err);
				reject('Server encouters error: ' + err);
			});
		});
	}
	return waitForServerStart()
	.then(runTest)
	.finally(() => {
		teardown();
		if (serverProcess) {
			log.info('stop server');
			serverProcess.kill('SIGINT');
		}
		return serverStopProm;
	});
}

exports.setup = function() {
	beforeAll(startup);
	//afterAll(teardown);
};

exports.statusCodeOf = function(path) {
	return new Promise((resolve, reject) => {
		if (!_.startsWith(path, '/')) {
			path = '/' + path;
		}
		request(urlPrefix + path, (error, response, body)=> {
			if (error) {
				log.error(error);
				return reject(error);
			}
			resolve(response.statusCode);
		});
	});
};

exports.saveScreen = function(fileName) {
	var file = Path.resolve(config.resolve('destDir'), (fileName ? fileName : 'out.png'));
	driver.takeScreenshot().then(function(data) {
		var base64Data = data.replace(/^data:image\/png;base64,/, '');
		fs.writeFile(file, base64Data, 'base64', function(err) {
			if (err) {
				log.error(err);
			}
		});
	});
};

function startup() {
	jasmine.DEFAULT_TIMEOUT_INTERVAL = 10 * 1000;
}

function teardown(done) {
	if (driver) {
		log.info('driver close');
		driver.close();
		driver.quit();
		driver = null;
		if (done) {
			done();
		}
	} else {
		if (done) {
			done();
		}
	}
}

function setBrowser(name) {
	name = name ? name : 'firefox';
	log.debug('set browser ' + name);
	browser = name;
}

function waitForServerStart() {
	var tryCount = 1;
	log.debug('wait for server starting');//setTimeout(done, 5000);

	return new Promise((resolve, reject) => {
		tryConnectServer();
		function tryConnectServer() {
			if (tryCount > config.get('e2etestHelper.connectionTryCount', 15)) {
				reject('Server is not available');
				return;
			}
			tryCount++;
			log.debug('try to connect to server for times: ' + tryCount);
			setTimeout(()=> {
				request('http://localhost:' + config().port, (error, response, body) => {
					if (error) {
						if (error.code === 'ECONNREFUSED') {
							tryConnectServer();
						} else {
							log.error(error);
							reject('Server is not available');
							return;
						}
					} else {
						resolve();
					}
					if (response) {
						log.debug(response.statusCode);
					}
				});
			}, 1000);
		}
	});
}
/**
 * @Deprecated
 * This function is used in test spec;
 */
function waitForServer(done) {
	var tryCount = 1;
	log.debug('wait for server starting');//setTimeout(done, 5000);
	tryConnectServer(done);

	function tryConnectServer(done) {
		if (tryCount > config.get('e2etestHelper.tryConnectTimes', 15)) {
			done.fail('Server is not available');
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
