window.jQuery = require('jquery');
require('@dr/angularjs');

var m = angular.module('docUi', []);
module.exports = m;

require('./animation')(m);
