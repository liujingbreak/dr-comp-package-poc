var log = require('log4js').getLogger('exampleNodePackage');
var Path = require('path');
var mafia = require('./gangsta');
var Q = require('q');

module.exports = mafia;
module.exports.activate = activate;

var mafiaPromis = mafia();

function activate(api) {
	log.debug('Greeting from node package v%s !', require('./package.json').version);
	var quote;

	api.router().get('/', function(req, res) {
		log.debug('serving GET');
		res.render('template', {name: quote});
	});

	api.templateFolder(Path.join(__dirname, 'views'));

	haveFun(api).then(function(qu) {
		quote = qu;
	});
}

function haveFun(api) {
	var def = Q.defer();

	api.eventBus.on('serverStarted', function() {
		mafiaPromis.then(function(res) {
			log.info('   "' + res + '"  ');
			def.resolve(res);
			return res;
		});
	});
	return def.promise;
}
