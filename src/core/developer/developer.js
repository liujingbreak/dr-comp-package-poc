
exports.activate = function(api) {
	if (!api.config().devMode) {
		return;
	}
	require('q').longStackSupport = true;
};
