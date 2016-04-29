exports.before = function() {
	console.log('hellow');
};

exports['Demo test'] = function(client) {
	client.url('http://www.baidu.com').pause(2000);
	client.end();
};
