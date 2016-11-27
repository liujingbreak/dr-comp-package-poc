var lazyAngularUtils = require('./lazyAngularUtils');

exports.cache = function(mainModule) {
	mainModule.config(lazyAngularUtils.cacheInternals);
	lazyAngularUtils.makeLazyAngular();
};
