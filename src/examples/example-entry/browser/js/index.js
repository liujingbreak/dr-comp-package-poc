var $ = require('jquery');

console.log(' let\'s if browserify works for requiring stuff from another file: ' + require('./exportText'));

$('#demoMessage').html('Hellow ' + __api.packageName);

module.exports = require('./exportText');
