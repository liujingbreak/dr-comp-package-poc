var runtime = {};

module.exports = {
	config: function() {
		return runtime.config();
	},

	activate: function(api) {
		runtime.config = config;
	}
};
