module.exports = function(routes) {
	console.log('Greeting from node package v%s !', require('./package.json').version);
};
