var api = require('__api');

exports.activate = function() {
	api.router().get('/', (req, res) => {
		res.render('views/body.html', {api: api});
	});
};
