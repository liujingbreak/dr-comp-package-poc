var fs = require('fs');
var Path = require('path');
var config = require('../config');
var mkdirp = require('mkdirp');
// var log = require('log4js').getLogger(Path.basename(__filename));

module.exports = {
	readTimestamp: readTimestamp,
	writeTimestamp: writeTimestamp
	//FilesReadStream: FilesReadStream
};

var timeStampCache = null;
var file = Path.join(config.resolve('destDir'), 'timestamp.txt');

/**
 * @param  {string} name [description]
 * @return {number}      returns null if there is no timestamp file
 */
function readTimestamp(name) {
	if (timeStampCache) {
		return timeStampCache[name];
	}
	if (!fs.existsSync(file)) {
		return null;
	}
	var txt = fs.readFileSync(file, 'utf8');
	timeStampCache = JSON.parse(txt);
	return timeStampCache ? timeStampCache[name] : null;
}

function writeTimestamp(name) {
	var time = new Date().getTime();
	if (!timeStampCache) {
		if (!fs.existsSync(file)) {
			timeStampCache = {};
		} else {
			var txt = fs.readFileSync(file, 'utf8');
			timeStampCache = JSON.parse(txt);
		}
	}
	timeStampCache[name] = time;
	mkdirp.sync(Path.dirname(file));
	fs.writeFileSync(file, JSON.stringify(timeStampCache, null, '\t'));
}
