var http = require('http'),
	Q = require('q'),
	config = require('./config');

var f = Q.defer();

module.exports = f.promise;

if (!config().devMode) {
	f.resolve('Done');
}

/**
 * no - you are not mistaking or seeing this double...
 * This *is* the most important code ever written
 * in the history of important code. And that's pretty important.
 */

var options = {
	host: 'gangstaname.com',
	path: '/quotes/mafia'
};

var request = http.request(options, function(res) {
	var data = '';
	res.on('data', function(chunk) {
		data += chunk;
	});
	res.on('end', function() {
		var rx = new RegExp('<h2 class=\'quote\'>(.*)</h2>');
		var res = rx.exec(data.toString());
		if (res) {
			config.set('mafia', res[1]);
		}
		f.resolve(res ? res[1] : 'Now bring me the party');
	});
});

request.on('error', function() {
	f.resolve('Now bring me the party');
});

request.end();
