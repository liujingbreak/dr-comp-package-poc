/* global -Promise */
var fs = require('fs');
var Promise = require('bluebird');
var _ = require('lodash');
var log = require('@dr/logger').getLogger('browserifyBuilder.fileCache');
var readFileAsync = Promise.promisify(fs.readFile, {context: fs});
var writeFileAsync = Promise.promisify(fs.writeFile, {context: fs});

module.exports = SimpleCache;

function SimpleCache(tempDir) {
	this.fileJsonCache = {};
}

SimpleCache.prototype.mergeWithJsonCache = function(filePath, override) {
	var prom;
	var self = this;
	var cache = this.fileJsonCache[filePath];
	if (cache) {
		newJson = _.assign(cache, override);
		this.fileJsonCache[filePath] = newJson;
		return Promise.resolve(newJson);
	}

	if (fs.existsSync(filePath)) {
		prom = readFileAsync(filePath, 'utf8').then(function(data) {
			log.debug(filePath + ' cache found');
			var newJson = _.assign(JSON.parse(data), override);
			return newJson;
		});
	} else {
		var newJson = override;
		prom = Promise.resolve(override);
	}

	return prom.then(function(newJson) {
		self.fileJsonCache[filePath] = newJson;
		return newJson;
	});
};

SimpleCache.prototype.tailDown = function() {
	var proms = [];
	_.forOwn(this.fileJsonCache, function(cache, file) {
		log.debug('writing to cache ' + file);
		//log.debug(cache);
		proms.push(
			writeFileAsync(file, JSON.stringify(cache, null, '\t')));
	});
	return Promise.all(proms);
};
