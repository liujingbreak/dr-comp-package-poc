var api = require('__api');

exports.activate = function() {
	api.router().get('/packages', (req, res) => {
		res.send(['hellow']);
	});
};
