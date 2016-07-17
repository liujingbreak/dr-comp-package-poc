var api = require('__api');

exports.activate = function() {
	api.router().get('/comp-list', (req, res) => {
		res.send({
			list: []
		});
	});
};
