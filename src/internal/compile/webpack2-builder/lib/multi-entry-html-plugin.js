const wps = require('webpack-sources');
var log = require('log4js').getLogger('wfh.MultiEntryHtmlPlugin');
var _ = require('lodash');
const sourceMappingURL = require('source-map-url');
var cheerio = require('cheerio');
var fs = require('fs');
var Path = require('path');
var Promise = require('bluebird');
//var readFile = Promise.promisify(fs.readFile);
var nextIdent = 0;

var realpathAsync = Promise.promisify(fs.realpath);
/**
 * @param opts.inlineChunk: array | string
 * @param opts.entryHtml: {[chunName: string]: array|string}, key is Chunk name, value is file path
 * All plugins registerd on compilation "multi-entry-html-emit-assets", will be invoked with parameter: `{path: string, $: cheerio}`,
 * plugin must return altered object `{path: string|Array<path:string>}` or `{path: string|Array<path:string>, html: string}`
 *
 * @param opts.onCompile: function(filePath, cheerio)
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
	var applyPluginsAsyncWaterfall;
	var applyPluginsAsync;
	// read options.context
	if (!plugin.opts.context) {
		compiler.plugin('entry-option', function(context) {
			plugin.opts.context = context;
		});
	}

	compiler.plugin('emit', function(compilation, callback) {
		applyPluginsAsyncWaterfall = Promise.promisify(compilation.applyPluginsAsyncWaterfall.bind(compilation));
		// default one in case there is no other plugin registered
		compilation.plugin('multi-entry-html-emit-assets', function(htmlAssets, callback) {
			callback(null, htmlAssets);
		});
		var inlineAssests = inlineChunk(compilation, plugin.opts.inlineChunk);
		applyPluginsAsync = Promise.promisify(compilation.applyPluginsAsync.bind(compilation));
		assetsByEntry(compilation, inlineAssests)
		.then(() => callback())
		.catch(err => callback());
	});

	function assetsByEntry(compilation, inlineAssests) {
		var all = [];
		var entryHtmls = plugin.opts.entryHtml;
		_.each(entryHtmls, (files, entryName) => {
			files = [].concat(files);
			_.each(files, htmlFile => {
				all.push(realpathAsync(htmlFile)
				.then(realFile => {
					log.info('\t\tEntry page: %s', realFile);
					return doHtmlAsync(compilation, entryName, realFile, inlineAssests);
				}));
			});
		});
		return Promise.all(all)
		.catch(err => {
			log.error(err);
			throw err;
		});
	}

	function doHtmlAsync(compilation, entrypointName, file, inlineAssests) {
		return Promise.coroutine(function*() {
			var relativePath = Path.relative(compiler.options.context || process.cwd(), file);
			// return readFile(file, 'utf8')
			// .then(content => {
			if (!compiler._lego_entry)
				return Promise.resolve(`Entry page ${relativePath} is failed to compiled by loader`);
			var content = compiler._lego_entry[relativePath];
			var $;
			try {
				$ = cheerio.load(content, {decodeEntities: false});
			} catch (e) {
				log.error(`File: ${file}\n` + content);
				throw e;
			}
			var body = $('body');
			var head = $('head');
			if (plugin.opts.onCompile) {
				plugin.opts.onCompile(file, $);
			}
			//yield applyPluginsAsync('multi-entry-html-compile-html', file, $);
			var scriptIdx = 0;
			_.each(compilation.entrypoints[entrypointName].chunks, chunk => {
				var s;
				if (_.has(inlineAssests, chunk.name)) {
					s = plugin.createScriptElement($, inlineAssests[chunk.name]);
					s.attr('data-mehp-index', (scriptIdx++) + '');
					body.append(s);
				} else {
					_.each(chunk.files, file => {
						if (_.endsWith(file, '.js')) {
							s = plugin.createScriptLinkElement($, resolveBundleUrl(file, compiler.options.output.publicPath));
							s.attr('data-mehp-index', (scriptIdx++) + '');
							body.append(s);
						} else if (_.endsWith(file, '.css')) {
							s = plugin.createCssLinkElement($, resolveBundleUrl(file, compiler.options.output.publicPath));
							s.attr('data-mehp-index', (scriptIdx++) + '');
							head.append(s);
						}
					});
				}
			});
			var data = yield applyPluginsAsyncWaterfall('multi-entry-html-emit-assets', {
				absPath: file,
				path: relativePath,
				$: $
			});
			var paths = [].concat(data.path);
			for (let path of paths) {
				path = path.replace(/\.([^.]+)$/, '.html');
				compilation.assets[path] = new wps.CachedSource(new wps.RawSource(
					data.html || $.html()));
			}
		})();
	}

	/**
	 * inlineChunk returns a hash object {key: chunkName, value: inline string}
	 * @param compilation: Compilation
	 * @param chunkNames: string[]
	 * @return {}
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

MultiEntryHtmlPlugin.prototype.createScriptLinkElement = function($, jsPath) {
	var scriptEl = $(`<script>`);
	if (!jsPath)
		return null;
	scriptEl.attr('type', 'text/javascript');
	scriptEl.attr('charset', 'utf-8');
	scriptEl.attr('src', jsPath);
	return scriptEl;
};

MultiEntryHtmlPlugin.prototype.createScriptElement = function($, content) {
	var scriptEl = $('<script>');
	scriptEl.attr('type', 'text/javascript');
	scriptEl.text('\n' + content);
	return scriptEl;
};

MultiEntryHtmlPlugin.prototype.createCssLinkElement = function($, cssPath) {
	var element = $('<link/>');
	if (!cssPath)
		return null;
	var src = resolveBundleUrl(cssPath, cssPath);
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
		return (urlPrefix ? _.trimEnd(urlPrefix, '/') : '') + '/' + bundlePath;
}
