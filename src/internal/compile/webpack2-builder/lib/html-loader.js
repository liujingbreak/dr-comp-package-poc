const api = require('__api');
const log = require('log4js').getLogger('wfh.html-loader');
// const Path = require('path');
// const loaderUtils = require('loader-utils');
// const Path = require('path').posix;
// const pify = require('pify');
const _ = require('lodash');
const cheerio = require('cheerio');
const vm = require('vm');

module.exports = function(content) {
	var callback = this.async();
	if (!callback) {
		this.emitError('loader does not support sync mode');
		throw new Error('loader does not support sync mode');
	}
	load(content, this)
	// .then(result => {
	// 	log.info(result);
	// 	return result;
	// })
	.then(result => this.callback(null, result))
	.catch(err => {
		this.callback(err);
		this.emitError(err);
		log.error(err);
	});
};

function load(content, loader) {
	var proms = [];

	var file = loader.resourcePath;
	var $ = cheerio.load(content, {decodeEntities: false});
	var html = $('html');
	if (!html.attr('lang') || html.attr('lang') === '')
		html.attr('lang', api.getBuildLocale());
	['href', 'src', 'srcset', 'ng-src'].forEach(attrName => {
		$('[' + attrName + ']').each(function(idx) {
			doAttrAssetsUrl.call(this, idx, attrName, file, loader, $, proms);
		});
	});

	//return Promise.resolve($.html());
	return Promise.all(proms).then(() => $.html());
}

function doAttrAssetsUrl(idx, attrName, file, loader, $, proms) {
	var el = $(this);
	var src = el.attr(attrName);
	if (!src)
		return;
	if (attrName === 'srcset') {
		proms.push(doSrcSet(el.attr('srcset'), loader)
			.then(value => el.attr(attrName, value)));
	} else if (attrName === 'src' && el.prop('tagName') === 'IMG' && !/^(?:https?:|\/\/|data:)/.test(src)) {
		let p = loaderUrl(src, loader)
			.then(url => {
				el.attr('src', url);
			});
		proms.push(p);
	}
}

function doSrcSet(value, loader) {
	var prom = value.split(/\s*,\s*/).map(urlSet => {
		urlSet = _.trim(urlSet);
		let factors = urlSet.split(/\s+/);
		let image = factors[0];
		return loaderUrl(image, loader)
		.then(url => {
			return url + ' ' + factors[1];
		});
	});
	return Promise.all(prom)
	.then(urlSets => urlSets.join(', '));
}

function loaderUrl(src, loader) {
	var res = api.normalizeAssetsUrl(src, loader.resourcePath);
	if (_.isObject(res)) {
		return Promise.resolve(api.assetsUrl(res.packageName, res.path));
	}
	if (/^(?:https?:|\/\/|data:)/.test(src))
		return Promise.resolve(src);
	if (src.charAt(0) === '/')
		return Promise.resolve(src);
	if (src.charAt(0) !== '.')
		src = './' + src;
	return new Promise((resolve, reject) => {
		loader.loadModule(src, (err, source, sourceMap, module) => {
			if (err)
				return reject(err);
			var sandbox = {
				__webpack_public_path__: loader.options.output.publicPath,
				module: {
					exports: {}
				}
			};
			vm.runInNewContext(source, vm.createContext(sandbox));
			//log.debug(src + '\n' + source + '\n => ' + sandbox.module.exports);
			resolve(sandbox.module.exports);
		});
	});
}
