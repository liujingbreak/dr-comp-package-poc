var glob = require('glob');
var path = require('path');
var Q = require('q');
var logger = require('log4js').getLogger(__filename);
var config = require('../config');

loadAllPackages();

module.exports = {
	loadAllPackages: loadAllPackages
};

function loadAllPackages() {
	var finder = new glob.Glob('**/package.json', {cwd: config().srcDir});
	finder.on('match', function(evt) {
		logger.debug(evt);
	}).on('error', function(er) {
		logger.error(er);
	});
}

function loadPackage(path) {
	
}
