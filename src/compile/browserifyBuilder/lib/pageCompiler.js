var _ = require('lodash');
var fs = require('fs');
var cheerio = require('cheerio');
var Path = require('path');
var Q = require('q');
var through = require('through2');
var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
var File = require('vinyl');
var swig = require('swig');
var log = require('@dr/logger').getLogger('browserifyBuilder.pageCompiller');

exports.stream = function() {
	var buildInfo;

	return through.obj(function(param, encoding, cb) {
		log.info('------- compiling changed entry pages ---------');
		log.info('(Only the pages which depend on any changed bundles will be replaced)');
		buildInfo = param;
		cb();
	}, function(cb) {
		var promises = [];
		var self = this;
		_.forOwn(buildInfo.packageInfo.entryPageMap, function(instance, name) {
			if (!needUpdateEntryPage(buildInfo.builtBundles, buildInfo.bundleDepsGraph[name])) {
				return;
			}
			log.info('Entry page replaced: ' + instance.entryHtml);

			var prom = Q.nfcall(fs.readFile, instance.entryHtml, 'utf-8')
			.then(function(content) {
				var $ = cheerio.load(content);
				injectElements($, buildInfo.bundleDepsGraph[name], instance, buildInfo.config, buildInfo.revisionMeta);
				var hackedHtml = $.html();

				var htmlName = Path.basename(instance.entryHtml);
				var pageRelFolder = Path.relative(instance.packagePath, Path.dirname(instance.entryHtml));
				if (instance.isEntryServerTemplate) {
					self.push(new File({
						path: Path.resolve('server', instance.shortName, pageRelFolder, htmlName),
						contents: new Buffer(hackedHtml)
					}));
				} else {
					self.push(new File({
						path: Path.resolve('static', instance.shortName, pageRelFolder, htmlName),
						contents: new Buffer(hackedHtml)
					}));
				}
			});
			promises.push(prom);
		});
		Q.all(promises).then(function() {
			cb();
		}).catch(function(err) {
			log.error(err);
			self.emit('error', new PluginError('browserifyBuilder.pageCompiler', err.stack, {showStack: true}));
		});
	});
};

function needUpdateEntryPage(builtBundles, bundleSet) {
	return builtBundles.some(function(bundleName) {
		return {}.hasOwnProperty.call(bundleSet, bundleName);
	});
}

var apiBootstrapTpl = swig.compileFile(Path.join(__dirname, 'templates', 'entryPageBootstrap.js.swig'), {autoescape: false});

function injectElements($, bundleSet, pkInstance, config, revisionMeta) {
	var body = $('body');
	var head = $('head');
	_injectElementsByBundle($, head, body, 'labjs', config, revisionMeta);
	delete bundleSet.labjs; // make sure there is no duplicate labjs bundle
	var jsLinks = [];
	_.forOwn(bundleSet, function(v, bundleName) {
		var file = 'js/' + bundleName + (config().devMode ? '' : '.min') + '.js';
		if (!revisionMeta[file]) {
			return null;
		}
		log.trace(file + ' -> ' + revisionMeta[file]);
		var src = config().staticAssetsURL + '/' + revisionMeta[file];
		var rs = URL_PAT.exec(src);
		src = (rs[1] ? rs[1] : '') + rs[2].replace(/\/\/+/g, '/');
		jsLinks.push(src);

		var bundleCss = createCssLinkElement($, bundleName, config, revisionMeta);
		if (bundleCss) {
			head.append(bundleCss);
		}
	});
	body.append($('<script>').html(apiBootstrapTpl({
		jsLinks: jsLinks,
		entryPackage: pkInstance.longName,
		debug: !!config().devMode,
		staticAssetsURL: JSON.stringify(config().staticAssetsURL),
		serverURL: JSON.stringify(config().serverURL),
		packageContextPathMapping: JSON.stringify(config().packageContextPathMapping)
	})));
}

function _injectElementsByBundle($, head, body, bundleName, config, revisionMeta) {
	var bundleScript = createScriptElement($, bundleName, config, revisionMeta);
	var bundleCss = createCssLinkElement($, bundleName, config, revisionMeta);
	if (bundleScript) {
		body.append(bundleScript);
	}
	if (bundleCss) {
		head.append(bundleCss);
	}
}

var URL_PAT = /^((?:[^:\/]+:)?\/)?(.*)$/;

function createScriptElement($, bundleName, config, revisionMeta) {
	var scriptEl = $('<script>');
	var file = 'js/' + bundleName + (config().devMode ? '' : '.min') + '.js';
	if (!revisionMeta[file]) {
		return null;
	}
	log.trace(file + ' -> ' + revisionMeta[file]);
	var src = config().staticAssetsURL + '/' + revisionMeta[file];
	var rs = URL_PAT.exec(src);
	src = (rs[1] ? rs[1] : '') + rs[2].replace(/\/\/+/g, '/');
	scriptEl.attr('src', src);
	return scriptEl;
}

function createCssLinkElement($, bundleName, config, revisionMeta) {
	var element = $('<link/>');
	var file = 'css/' + bundleName + '.css';
	if (!revisionMeta[file]) {
		return null;
	}
	log.trace(file + ' -> ' + revisionMeta[file]);
	var src = config().staticAssetsURL + '/' + revisionMeta[file];
	var rs = URL_PAT.exec(src);
	src = (rs[1] ? rs[1] : '') + rs[2].replace(/\/\/+/g, '/');
	element.attr('rel', 'stylesheet');
	element.attr('href', src);
	element.attr('type', 'text/css');

	return element;
}
