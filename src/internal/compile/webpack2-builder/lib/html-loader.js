const api = require('__api');
const log = require('log4js').getLogger('wfh.html-loader');
const loaderUtils = require('loader-utils');
const Path = require('path');
const pify = require('pify');
const _ = require('lodash');
const cheerio = require('cheerio');
var replaceAssetsUrl = require('./css-url-assets-loader').replaceAssetsUrl;

module.exports = function(content) {
	var callback = this.async();
	if (!callback) {
		this.emitError('loader does not support sync mode');
		throw new Error('loader does not support sync mode');
	}
	loadAsync(content, this)
	.then(result => this.callback(null, result))
	.catch(err => {
		this.callback(err);
		log.error(err);
	});
};
function loadAsync(content, loader) {
	try {
		return load(content, loader);
	} catch (e) {
		log.error(e);
		return Promise.reject(e);
	}
}

function load(content, loader) {
	var proms = [];

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
		} else if (attrName === 'src' && el.prop('tagName') === 'IMG' && !/^(https?:|\/)/.test(src)) {
			var linkedFile;
			var p = pify(loader.resolve.bind(loader))(loader.context, /^[~.\/]/.test(src) ? src : './' + src)
			.then(f => {
				linkedFile = f;
				return new Promise((resolve, rej) => {
					try {
						loader.fs.readFile(f, (err, content) => {
							if (err)
								return rej(err);
							resolve(content);
						});
						loader.addDependency(f);
					} catch (e) {
						rej(`Failed to read file ${f}: ` + e);
					}
				});
			})
			.then(content => {
				var url = loaderUtils.interpolateName(_.assign({}, loader, {resourcePath: linkedFile}),
					'[path][name].[md5:hash:hex:8].[ext]',
					{context: loader.options.context, content: content}
				);
				var outputPath = '';
				var filePath = loader.context + '/' + src;
				var browserPackage = api.findPackageByFile(filePath);
				if (browserPackage) {
					outputPath = _.trimStart(api.config.get(['outputPathMap', browserPackage.longName]), '/') +
						'/' + Path.dirname(Path.relative(browserPackage.realPackagePath, filePath)).split(Path.sep).join('/');
					url = url.split('/').pop();
				} else
					url = url.replace(/(^|\/)node_modules(\/|$)/g, '$1n-m$2').replace(/@/g, 'a');
				url = outputPath + '/' + url;
				el.attr('src', loader.options.output.publicPath + url);
				loader.emitFile(url, content);
				//loader.addDependency(file);
			})
			.catch(e => {
				loader.emitError(e);
				log.error(e);
				throw e;
			});
			proms.push(p);
		}
	}
	//return Promise.resolve($.html());
	return Promise.all(proms).then(() => $.html());
}

