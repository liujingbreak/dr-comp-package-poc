window.jQuery = require('jquery');
require('@dr/angularjs');

var m = angular.module('docUi', []);
require('./menu')(m);
module.exports = m;
