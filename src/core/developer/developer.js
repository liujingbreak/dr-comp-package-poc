var log = require('@dr/logger').getLogger('developer');
exports.activate = function(api) {
	if (!api.config().devMode) {
		return;
	}
	require('q').longStackSupport = true;
};
