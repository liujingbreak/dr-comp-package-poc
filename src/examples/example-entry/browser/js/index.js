var $ = require('jquery');
require('@dr/example-partial');
var api = require('__api');

console.log(' let\'s see if browserify works for requiring stuff from another file: ' + require('./exportText'));

$('#demoMessage').html('Hellow ' + api.packageName);

module.exports = require('./exportText');
