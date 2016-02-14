var __r = require;
require = function(file) {
	console.log('require ' + file);
	return __r.apply(this, arguments);
};
