var env = {
	config: function() {
		return env.config;
	},

	activate: function(api, apiPrototype) {
		env.config = api.config;
		env.api = apiPrototype;
		env.packageUtils = apiPrototype.packageUtils;
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
