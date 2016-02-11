var Path = require('path');
var log = require('@dr/logger').getLogger(__filename);


module.exports.activate = function(api) {
	api.router().get('/', function(req, res) {
		res.redirect('/' + api.packageName + '/index.html');
	});
};
