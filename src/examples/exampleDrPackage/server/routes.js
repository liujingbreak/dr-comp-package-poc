var mafia = require('@dr/example-node');
var log = require('log4js').getLogger(__filename);
var Path = require('path');

module.exports = function(api) {
	api.router().get('/route1', function(req, res) {
		mafia().then(function(text) {
			res.send('Mafia words: "' + text + '"');
		})
		.catch(function(er) {
			log.error('', er);
			res.send(er);
		});
	});

	api.router().get('/route2', function(req, res) {
		mafia().then(function(text) {
			res.render('exampleDr-mafia', {
				path: Path.join(api.packageInstance.path, 'server', 'views', 'exampleDr-mafia.html'),
				words: text
			});
		})
		.catch(function(er) {
			log.error('', er);
			res.send(er);
		});
	});
};
