var Path = require('path');
var log = require('@dr/logger').getLogger(__filename);


module.exports.activate = function(api) {
	api.router().get('/', function(req, res) {
		//res.sendFile(Path.resolve(api.config().distDir, './views/main.html'));
		res.send('ok');
	});
};
