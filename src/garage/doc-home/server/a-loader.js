const api = require('__api');
const log = require('log4js').getLogger(api.packageName + '.html-anchor-loader');
//const lu = require('loader-utils');
var cheerio = require('cheerio');

module.exports = function(content) {
	var callback = this.async();
	loadAsync(content, this)
	.then(result => callback(null, result))
	.catch(err => {
		log.error(err);
		callback(err);
	});
};

function loadAsync(content, loader) {
	var $ = cheerio.load(content, {decodeEntities: false});
	$('h2').each(function(idx) {
		var el = $(this);
		log.info('h2 %s', el.text());
	});
	return Promise.resolve($.html());
}
