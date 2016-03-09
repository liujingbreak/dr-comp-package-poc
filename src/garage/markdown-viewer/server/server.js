var Promise = require('bluebird');
var fs = require('fs');
var Markdown = require('markdown-it');
var mk = new Markdown();

var cache = {};

module.exports = function(file) {
	if ({}.hasOwnProperty.call(cache, file)) {
		return Promise.resolve(cache[file]);
	}

	var text = fs.readFileSync(file, 'utf8');
	var html = mk.render(text);
	cache[file] = html;
	return Promise.resolve(html);
};
