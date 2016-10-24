window.jQuery = require('jquery');
require('@dr/angularjs');
require('@dr/font-awesome-4');

var m = angular.module('docUi', []);
module.exports = m;

require('./animation')(m);
require('./loading.js').create(m);
