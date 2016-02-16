var runtime = {};

if (process.browser) {
	runtime.api =  new (require('./browser-api'))();
} else {
	runtime.api = null; // TODO: nodeAPI
}

module.exports = {
	config: function() {
		return runtime.config;
	},

	activate: function(api) {
		runtime.config = api.config;
	}
};
