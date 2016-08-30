
exports.activate = function(api) {
	api.router().get('/server', function(req, res) {
		console.log('here');
		res.send(api.assetsUrl('/resource.json'));
	});
};
