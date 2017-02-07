const wps = require('webpack-sources');
var log = require('log4js').getLogger('MultiEntryHtmlPlugin');
var _ = require('lodash');
const sourceMappingURL = require('source-map-url');
var cheerio = require('cheerio');
var fs = require('fs');
var Path = require('path');
var Promise = require('bluebird');
var readFile = Promise.promisify(fs.readFile);
var nextIdent = 0;

/**
 * @param opts.inlineChunk: {array | string}
 * @param opts.entryHtml object.<entryName: string, filePath: array|string>
 * @param opts.publicPath: {string} same as output.publicPath
 */
function MultiEntryHtmlPlugin(opts) {
	this.ident = __filename + (nextIdent++);
	this.opts = opts;
	if (!opts.inlineChunk)
		opts.inlineChunk = [];
}

module.exports = MultiEntryHtmlPlugin;

MultiEntryHtmlPlugin.prototype.apply = function(compiler) {
	var plugin = this;
	// read options.context
	if (!plugin.opts.context) {
		compiler.plugin('entry-option', function(context) {
			plugin.opts.context = context;
		});
	}

	compiler.plugin('emit', function(compilation, callback) {
		var inlineAssests = inlineChunk(compilation, plugin.opts.inlineChunk);
		assetsByEntry(compilation, inlineAssests)
		.then(() => callback())
		.catch(err => callback(err));
		//compilation.assets['testentry/test.html'] = new wps.CachedSource(new wps.RawSource('fffhfhfhfh'));
	});

	function assetsByEntry(compilation, inlineAssests) {
		var all = [];
		var entryHtmls = plugin.opts.entryHtml;
		_.each(compilation.entrypoints, (entrypoint, name) => {
			log.debug('entrypoint %s', name);
			_.each(entrypoint.chunks, chunk => {
				log.debug('\t%s', chunk.files[0]);
				_.each(entryHtmls[chunk.name], file => {
					log.debug('\t\tpage: %s', file);
					all.push(doHtmlAsync(compilation, name, file, inlineAssests));
				});
			});
		});
		return Promise.all(all);
	}

	function doHtmlAsync(compilation, entrypointName, file, inlineAssests) {
		return readFile(file, 'utf8')
		.then(content => {
			var $ = cheerio.load(content, {decodeEntities: false});
			var body = $('body');
			_.each(compilation.entrypoints[entrypointName].chunks, chunk => {
				var s;
				if (_.has(inlineAssests, chunk.name))
					s = plugin.createScriptElement($, inlineAssests[chunk.name]);
				else
					s = plugin.createScriptLinkElement($, resolveBundleUrl(chunk.files[0], plugin.opts.publicPath));
				body.append(s);
			});
			var html = $.html();
			html = new wps.CachedSource(new wps.RawSource(html));
			compilation.assets[Path.relative(plugin.opts.context, file)] = html;
			return html;
		});
	}

	/**
	 * inlineChunk returns a hash object {key: chunkName, value: inline string}
	 * @param  {[type]} compilation [description]
	 * @param  {[type]} chunkNames  [description]
	 * @return {[type]}             [description]
	 */
	function inlineChunk(compilation, chunkNames) {
		if (!chunkNames || chunkNames.length === 0)
			return {};
		var nameSet = {};
		_.each([].concat(chunkNames), name => nameSet[name] = 1);
		var size = _.size(nameSet);
		var inlineChunks = [];
		_.some(compilation.chunks, chunk => {
			if (_.has(nameSet, chunk.name)) {
				delete nameSet[chunk.name];
				inlineChunks.push(chunk);
				size--;
			}
			return size === 0;
		});
		var inlineCodes = {};
		_.each(inlineChunks, chunk => {
			log.info('inline %s', chunk.files[0]);
			inlineCodes[chunk.name] = sourceMappingURL.removeFrom(compilation.assets[chunk.files[0]].source());
		});
		return inlineCodes;
	}
};

MultiEntryHtmlPlugin.prototype.createScriptLinkElement = function($, jsPath, config) {
	var scriptEl = $('<script>');
	if (!jsPath)
		return null;
	var src = resolveBundleUrl(jsPath, this.opts.publicPath);
	scriptEl.attr('type', 'text/javascript');
	scriptEl.attr('charset', 'utf-8');
	scriptEl.attr('src', src);
	return scriptEl;
};

MultiEntryHtmlPlugin.prototype.createScriptElement = function($, content, config) {
	var scriptEl = $('<script>');
	scriptEl.text(content);
	return scriptEl;
};

MultiEntryHtmlPlugin.prototype.createCssLinkElement = function($, cssPath, config) {
	var element = $('<link/>');
	if (!cssPath)
		return null;
	var src = resolveBundleUrl(cssPath, this.opts.publicPath);
	//var src = this.opts.publicPath + '/' + api.localeBundleFolder() + mappedFile;
	//var rs = URL_PAT.exec(src);
	//src = (rs[1] ? rs[1] : '') + rs[2].replace(/\/\/+/g, '/');
	element.attr('rel', 'stylesheet');
	element.attr('href', src);
	element.attr('type', 'text/css');

	return element;
};

function resolveBundleUrl(bundlePath, urlPrefix) {
	if (!urlPrefix)
		urlPrefix = '';
	if (bundlePath.charAt(0) === '/' || (bundlePath.length >= 7 &&
			(bundlePath.substring(0, 7) === 'http://' || bundlePath.substring(0, 8) === 'https://')))
		return bundlePath;
	else
		return (urlPrefix ? urlPrefix : '') + '/' + bundlePath;
}
