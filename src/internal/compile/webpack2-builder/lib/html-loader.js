const api = require('__api');
const log = require('log4js').getLogger(api.packageName + '.html-loader');
//const _ = require('lodash');
const cheerio = require('cheerio');
var replaceAssetsUrl = require('./css-url-assets-loader').replaceAssetsUrl;

module.exports = function(content) {
	var callback = this.async();
	if (!callback)
		return load(content, this);
	return loadAsync(content, this)
	.then(result => callback(null, result))
	.catch(err => callback(err));
};

function load(content, loader) {
	var file = loader.resourcePath;
	var $ = cheerio.load(content, {decodeEntities: false});
	$('[href]').each(function(idx) {
		doAttrAssetsUrl.call(this, idx, 'href');
	});
	$('[src]').each(function(idx) {
		doAttrAssetsUrl.call(this, idx, 'src');
	});
	function doAttrAssetsUrl(idx, attrName) {
		var el = $(this);
		var src = el.attr(attrName);
		if (src.startsWith('assets://')) {
			log.debug('Found tag %s, %s: %s', el.prop('tagName'), attrName, el.attr(attrName));
			el.attr(attrName, replaceAssetsUrl(file, src, loader.options.output.publicPath));
		}
	}
	return $.html();
}

function loadAsync(content, loader) {
	try {
		return Promise.resolve(load(content, loader));
	} catch (e) {
		log.error(e);
		return Promise.reject(e);
	}
}

