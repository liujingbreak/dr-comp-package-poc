
module.exports.activate = function(api) {
	api.router().get('/', function(req, res) {
		res.redirect(api.assetsUrl('/index.html'));
	});
};
