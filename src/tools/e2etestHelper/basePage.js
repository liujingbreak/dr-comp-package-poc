var Path = require('path');
var log = require('@dr/logger').getLogger(Path.basename(__filename));
var _ = require('lodash');
var Promise = require('bluebird');

module.exports = Page;

function Page(path) {
	if (!(this instanceof Page)) {
		return new Page(path);
	}
	this.path = this.path ? this.path : '';

	this.url = this._urlPrefix + (_.startsWith(this.path, '/') ? '' : '/') + this.path;
	this.elements = {};
	// lazy restart webdriver
	Object.defineProperty(this, 'driver', {
		enumerable: true,
		configurable: true,
		get: function() {
			return require('./webdriverHelper').driver;
		}
	});
}

Page.prototype = {
	_urlPrefix: null,
	get: function(path, maxWaitTime) {
		var self = this;
		log.debug('get ' + this.url + (path ? path : ''));
		var getProm = this.driver.get(this.url + (path ? path : ''));
		var bothProm = [getProm, Promise.delay(maxWaitTime ? maxWaitTime : 7000)];
		// Sometimes the page can't finish loading, like trying to connect to google adv
		return Promise.any(bothProm).then(() => {
			log.debug('page loaded');
			return self.check();
		});
	},
	/**
	 * check if page is properly renderred
	 * @return {[type]} [description]
	 */
	check: function(done) {
		var all = [];
		_.forOwn(this.elements, (prop, name) => {
			var self = this;
			var proms = Promise.coroutine(function*() {
				if (!prop.required)
					return;
				log.debug('check element : ' + prop.selector);
				var presents = yield self.driver.isElementPresent({css: prop.selector});
				log.debug('presents:', presents);
				if (!presents) {
					return Promise.reject('Page object has a required element "' +
						name + '[' + this.elements[name].selector + ']' + '" which is not available');
				}
				expect(presents).toBe(true);
			})()
			.catch(e => {
				log.error('Failed to locate element ', name, ' ', prop.selector, e ? e.stack : '');
				throw new Error(e);
			});
			all.push(proms);
		});
		if (all.length === 0)
			return Promise.resolve();
		return Promise.all(all);
	},

	el: function(name, cssSelector, isRequired) {
		var css, cache;
		if (cssSelector) {
			return this.addElement(name, cssSelector, isRequired);
		}

		if (!_.has(this.elements, name)) {
			throw new Error('Page element is not defined: ' + name);
		}
		log.debug('element ' + this.elements[name].selector);
		var el = this.elements[name].cache;
		if (!el) {
			css = this.elements[name].selector;
			cache = this.driver.findElement({css: css});
			el = this.elements[name].cache = cache;
		}
		return el;
	},

	addElement: function(name, cssSelector, isRequired) {
		this.elements[name] = {
			name: name,
			selector: cssSelector,
			required: !!isRequired,
			cache: null
		};
		var self = this;
		// Allow to access page elements by property `pageObject[elementName]`
		// as well as `pageObject.el(elementName)`
		Object.defineProperty(this, name, {
			enumerable: true,
			configurable: true,
			get: function() {
				return self.el(name);
			}
		});
		return this;
	}
};
