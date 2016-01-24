var quote = require('./exportText');
var common = require('@dr/example-common');
console.log('greeting from package browser-side code');
console.log(' let\'s if browserify works for requiring stuff from another file: ' + quote);
console.log(common);
module.exports = quote;
