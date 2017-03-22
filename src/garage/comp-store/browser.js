require('./styles/main.less');

exports.init = function(app) {
	require('./js/comp-store.js').init(app);
};
