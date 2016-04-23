var favicon = require('serve-favicon');
var Path = require('path');

exports.activate = function(api) {
	api.use(favicon(Path.join(__dirname, 'favicon.ico')));
};
