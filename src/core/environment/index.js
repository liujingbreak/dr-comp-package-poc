var env = {
	activate: function(api, apiPrototype) {
		env.config = api.config;
		env.api = apiPrototype;
		env.packageUtils = apiPrototype.packageUtils;
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

var Promise = require('bluebird');
Promise.defer = defer;

function defer() {
	var resolve, reject;
	var promise = new Promise(function() {
		resolve = arguments[0];
		reject = arguments[1];
	});
	return {
		resolve: resolve,
		reject: reject,
		promise: promise
	};
}
