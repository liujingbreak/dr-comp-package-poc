const api = require('__api');
const log = require('log4js').getLogger('wfh.html-loader');
const loaderUtils = require('loader-utils');
const Path = require('path').posix;
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
	if (src.startsWith('assets://')) {
		log.debug('Found tag %s, %s: %s', el.prop('tagName'), attrName, el.attr(attrName));
		el.attr(attrName, replaceAssetsUrl(file, src, loader.options.output.publicPath));
	} else if (attrName === 'srcset') {
		proms.push(doSrcSet(el.attr('srcset'), loader).then(value => el.attr(attrName, value)));
	} else if (attrName === 'src' && el.prop('tagName') === 'IMG' && !/^(https?:|\/)/.test(src)) {
		let p = loaderUrl(src, loader)
		.then(url => {
			el.attr('src', loader.options.output.publicPath + url);
		});
		proms.push(p);
	}
}

function doSrcSet(value, loader) {
	var prom = [];

	for (let urlSet of value.split(/\s*,\s*/)) {
		urlSet = _.trim(urlSet);
		let factors = urlSet.split(/\s+/);
		let image = factors[0];

		let p = loaderUrl(image, loader)
		.then(url => {
			url = loader.options.output.publicPath + url;
			return url + ' ' + factors[1];
		});
		prom.push(p);
	}
	return Promise.all(prom)
	.then(urlSets => urlSets.join(', '));
}

function loaderUrl(src, loader) {
	var linkedFile;
	return pify(loader.resolve.bind(loader))(loader.context, /^[~.\/]/.test(src) ? src : './' + src)
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
		var hashedPath = loaderUtils.interpolateName(_.assign({}, loader, {resourcePath: linkedFile}),
			'[path][name].[md5:hash:hex:8].[ext]',
			{context: loader.options.context, content: content}
		);
		var filePath = Path.resolve(loader.context, src);
		var browserPackage = api.findPackageByFile(filePath);
		if (browserPackage) {
			let packageOutpath = _.trimStart(api.config.get(['outputPathMap', browserPackage.longName]), '/');
			let dir = Path.join(packageOutpath, Path.dirname(Path.relative(browserPackage.realPackagePath, filePath)));
			hashedPath = Path.join(dir, hashedPath.split('/').pop());
		} else
			hashedPath = hashedPath.replace(/(^|\/)node_modules(\/|$)/g, '$1n-m$2').replace(/@/g, 'a');
		//hashedPath = hashedPath.replace(/(^|\/)node_modules(\/|$)/g, '$1n-m$2').replace(/@/g, 'a');
		//console.log('%s , %s', hashedPath, outputPath);
		//hashedPath = Url.resolve(outputPath, hashedPath);
		loader.emitFile(hashedPath, content);
		return hashedPath;
	})
	.catch(e => {
		loader.emitError(e);
		log.error(e);
		throw e;
	});
}
