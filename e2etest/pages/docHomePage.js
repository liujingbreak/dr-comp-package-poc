// var Path = require('path');
// var log = require('@dr/logger').getLogger(Path.basename(__filename));
var util = require('util');
var helper = require('@dr/e2etest-helper');
var basePage = helper.basePage;
 var _ = require('lodash');

util.inherits(DocHomePage, basePage);

function DocHomePage() {
	DocHomePage.super_.call(this, '');
	this.el('body', '.doc-home', true);
	this.el('mainSection', '.main-section', true);
}

_.assign(DocHomePage.prototype, {

});


module.exports = new DocHomePage();
