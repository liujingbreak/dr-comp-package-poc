var $ = require('jquery');
require('@dr/example-partial');
var api = require('__api');

console.log(' let\'s see if browserify works for requiring stuff from another file: ' + require('./exportText'));

$('#demoMessage').html('Hellow ' + api.packageName);

api.packageMessage = 'I am a message shared within all files in this package';

module.exports = require('./exportText');

require('./printMessage');
