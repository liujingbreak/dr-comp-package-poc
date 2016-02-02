var mafia = require('@dr/example-node');
var log = require('log4js').getLogger(__filename);
var Path = require('path');

module.exports = {
	activate: function(api) {
		api.router().get('/', function(req, res) {
			res.render(api.getCompiledViewPath('index.html'),
				{contextPath: api.contextPath});
		});

		api.router().get('/route1', function(req, res) {
			mafia().then(function(text) {
				res.send('Mafia words: "' + text + '"');
			})
			.catch(function(er) {
				log.error('', er);
				res.send(er);
			});
		});

		api.router().get('/route1/:name', function(req, res) {
			mafia().then(function(text) {
				res.send(req.greeting + ',<br/> "' + text + '"');
			})
			.catch(function(er) {
				log.error('', er);
				res.send(er);
			});
		});

		api.router().get('/route2', function(req, res) {
			mafia().then(function(text) {
				res.render('server/views/exampleDr-mafia', {
					path: Path.join(api.packageInstance.path, 'server', 'views', 'exampleDr-mafia.html'),
					words: text
				});
			})
			.catch(function(er) {
				log.error('', er);
				res.send(er);
			});
		});

		api.use(function(req, res, next) {
			log.info('in package ' + api.packageName + '\'s middleware ');
			log.info('request path: ' + req.path);
			next();
		});

		api.router().param('name', function(req, res, next, name) {
			log.info('param name=' + name);
			req.greeting = 'Hellow ' + name;
			next();
		});
	}
};
