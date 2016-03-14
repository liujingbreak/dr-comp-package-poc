var log = require('log4js').getLogger('exampleNodePackage');
var mafia = require('./gangsta');
var Q = require('q');

module.exports = mafia;
module.exports.activate = activate;

var mafiaPromis = mafia();

function activate(api) {
	var quote;

	// browser access http://localhost:14333/example-node to see result
	api.router().get('/', function(req, res) {
		res.render('template', {name: quote});
	});

	haveFun(api).then(function(qu) {
		quote = qu;
	});
}

function haveFun(api) {
	var def = Q.defer();

	api.eventBus.on('serverStarted', function() {
		mafiaPromis.then(function(res) {
			log.info('\n   "' + res + '"\n' +
				'\t\\   ^__^\n\t \\  (oo)\\_______\n\t    (__)\\       )\\/\\\n\t        ||----w |\n\t        ||     ||');
			def.resolve(res);
			return res;
		});
	});
	return def.promise;
}
