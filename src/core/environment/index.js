var env = {
	config: function() {
		return env.config;
	},

	activate: function(api) {
		env.config = api.config;
		env.api = api;
	},

	/**
	 * called by gulp or other compilation time tool
	 */
	_setup: function(config, packageUtils) {
		env.config = config;
		env.packageUtils = packageUtils;
	}
};

if (process.browser) {
	env.api =  new (require('./browser-api'))();
}

module.exports = env;
