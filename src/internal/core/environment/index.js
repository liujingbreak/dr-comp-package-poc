var env = {
	activate: function(api) {
		env.config = api.config;
		env.api = Object.getPrototypeOf(api);
		env.packageUtils = env.api.packageUtils;
	},

	/**
	 * called by gulp or other compilation time tool
	 */
	_setup: function(config, packageUtils, buildUtils) {
		env.config = config;
		env.packageUtils = packageUtils;
		env.buildUtils = buildUtils;
	}
};
module.exports = env;
