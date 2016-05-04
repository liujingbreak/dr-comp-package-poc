//var Path = require('path');
//var log = require('@dr/logger').getLogger(Path.basename(__filename));
var _ = require('lodash');
var config = require('../../lib/config');
var driver = require('../webdriverHelper').driver;

module.exports = Page;
Page.create = function(properties, basePageInstance) {
	var BasePage = basePageInstance ? basePageInstance.constructor : Page;

	function SubPage() {
		BasePage.apply(this, arguments);
	}
	_.assign(properties.elements, BasePage.prototype.elements);
	SubPage.prototype = Object.create(BasePage.prototype, properties);
	return SubPage;
};

function Page(path) {
	if (!(this instanceof Page)) {
		return new Page(path);
	}
	this.path = this.path ? this.path : '';
	this.url = 'http://localhost:' + config().port + (_.startsWith(this.path, '/') ? '' : '/') + this.path;
}

Page.prototype = {
	get: function() {
		var self = this;
		driver.get(this.url)
		.then(() => {
			return self.check();
		});
	},
	/**
	 * check if page is properly renderred
	 * @return {[type]} [description]
	 */
	check: function() {
		expect(true).toBe(true);
		return true;
	}
};
