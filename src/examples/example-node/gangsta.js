var http = require('http'),
	Promise = require('bluebird');

module.exports = function() {
	/**
	 * no - you are not mistaking or seeing this double...
	 * This *is* the most important code ever written
	 * in the history of important code. And that's pretty important.
	 */
	var options = {
		host: 'gangstaname.com',
		path: '/quotes/mafia'
	};
	return new Promise((resolve, reject) => {
		var request = http.request(options, function(res) {
			var data = '';
			res.on('data', function(chunk) {
				data += chunk;
			});
			res.on('end', function() {
				var rx = new RegExp('<h2 class=\'quote\'>(.*)</h2>');
				var res = rx.exec(data.toString());
				resolve(res ? res[1] : 'Now bring me the party');
			});
		});

		request.on('error', function() {
			resolve('Now bring me the party');
		});

		request.end();
	});
};
