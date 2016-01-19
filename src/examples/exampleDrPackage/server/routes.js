var mafia = require('@dr/example-node');
var log = require('log4js').getLogger(__filename);

module.exports = function(router) {
	router.get('/mafia', function(req, res) {
		log.info('/mafia is routed');
		mafia().then(res.send)
		.catch(function(er) {
			log.error('', er);
			res.send(er);
		});
	});
};
