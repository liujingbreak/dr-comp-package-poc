/* global fail */
var Path = require('path');
var log = require('@dr/logger').getLogger(Path.basename(__filename));
var _ = require('lodash');
var Promise = require('bluebird');
// var config = require('@dr/environment').config;

module.exports = Page;

function Page(path) {
	if (!(this instanceof Page)) {
		return new Page(path);
	}
	this.path = this.path ? this.path : '';

	var urlPrefix = require('./webdriverHelper').urlPrefix;
	this.url = urlPrefix + (_.startsWith(this.path, '/') ? '' : '/') + this.path;
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

	get: function() {
		var self = this;
		log.debug('get ' + this.url);
		return this.driver.get(this.url)
		.then(() => {
			return self.check();
		});
	},
	/**
	 * check if page is properly renderred
	 * @return {[type]} [description]
	 */
	check: function() {
		var all = [];
		_.forOwn(this.elements, (prop, name) => {
			//log.debug('check: ' + this.elements[name].selector);
			var proms = this.driver.isElementPresent({css: this.elements[name].selector})
			.then(presents => {
				if (!presents) {
					return Promise.reject('Page object has a required element "' +
						name + '[' + this.elements[name].selector + ']' + '" which is not available');
				}
				expect(presents).toBe(true);
			})
			.catch(e => {
				fail(e);
				throw e;
			});
			all.push(proms);
		});
		return Promise.all(all);
	},

	el: function(name, cssSelector, isRequired) {
		var css, cache;
		if (cssSelector) {
			return this.addElement(name, cssSelector, isRequired);
		}

		if (!_.has(this.elements, name)) {
			fail('Page element is not defined: ' + name);
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
