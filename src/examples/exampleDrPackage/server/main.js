module.exports = {
	activate: function(api) {
		require('./routes')(api);

		api.templateFolder('server/views');
	}
};
