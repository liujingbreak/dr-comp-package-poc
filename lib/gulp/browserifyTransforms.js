var through = require('through2');
var gutil = require('gulp-util');
var Path = require('path');

exports.textHtml = textHtml;
exports.jsFileWrapper = jsFileWrapper;

function textHtml(file) {
	var ext = Path.extname(file).toLowerCase();
	if (ext === '.html' || ext === '.txt') {
		return through(function(buf, encoding, next) {
			this.push('module.exports = ' + JSON.stringify(buf.toString('utf-8')));
			next();
		});
	} else {
		return through(doNothing);
	}
}

function jsFileWrapper(file) {
	var ext = Path.extname(file).toLowerCase();
	if (ext === '.js') {
		return through(function(buf, encoding, next) {
			this.push('module.exports = ' + JSON.stringify(buf.toString('utf-8')));
			next();
		});
	} else {
		return through(doNothing);
	}
}

function doNothing(buf, encoding, next) {
	this.push(buf);
	next();
}
