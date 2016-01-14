var glob = require('glob');
var pth = require('path');
var Q = require('q');
var log = require('log4js').getLogger(__filename);
var fs = require('fs');
var putil = require('./packageUtils');
var config = require('../config');

loadAllPackages();

module.exports = {
	loadAllPackages: loadAllPackages
};

function loadAllPackages() {
	var finder = new glob.Glob('**/package.json', {cwd: config().srcDir});
	finder.on('match', function(path) {
		loadPackage(path, pth.resolve(config().srcDir, path));
	}).on('error', function(er) {
		log.error(er);
	});
}

function loadPackage(path, absPath) {
	var folder = pth.dirname(path);
	var packageJson = JSON.parse(fs.readFileSync(absPath));
	var name = putil.shortName(packageJson.name);
	log.debug('loading ' + name + ' from ' + folder);
}

function Package(packageJson) {
	this.name = putil.shortName(packageJson.name);
}
