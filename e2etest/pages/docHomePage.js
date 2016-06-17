// var Path = require('path');
// var log = require('@dr/logger').getLogger(Path.basename(__filename));
var util = require('util');
var helper = require('@dr/e2etest-helper');
var basePage = helper.basePage;
var _ = require('lodash');
var Promise = require('bluebird');

util.inherits(DocHomePage, basePage);

function DocHomePage() {
	DocHomePage.super_.call(this, '');
	this.el('body', '.doc-home', true);
	this.el('mainSection', '.main-section', true);
}

_.assign(DocHomePage.prototype, {
	check: function() {
		var self = this;
		return Promise.coroutine(function*() {
			self.faviconStatus = yield helper.statusCodeOf('/favicon.ico');
			return yield DocHomePage.super_.prototype.check.apply(self, arguments);
		})();
	}
});


module.exports = new DocHomePage();
