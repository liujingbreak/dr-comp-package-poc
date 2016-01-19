module.exports = {
	activate: function(api) {
		require('./server/routes')(api.router());
	}
};
