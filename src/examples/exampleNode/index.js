module.exports = function(api) {
	console.log('Greeting from node package v%s !', require('./package.json').version);

	api.route();
};
