// var Path = require('path');
// var log = require('@dr/logger').getLogger(Path.basename(__filename));
// var config = require('../../lib/config');
// var driver = require('../webdriverHelper');
var basePage = require('./page');
// var _ = require('lodash');

var DocHome = basePage.create({

});

module.exports = new DocHome();
