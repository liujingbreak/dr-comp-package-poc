var _ = require('lodash');
var fs = require('fs');
var cheerio = require('cheerio');
var Path = require('path');
var Q = require('q');
var through = require('through2');
var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
var File = require('vinyl');
var log = require('@dr/logger').getLogger('browserifyBuilder.pageCompiller');

exports.stream = function() {
	var packageInfo, bundleDepsGraph, config, revisionMeta;

	return through.obj(function(param, encoding, cb) {
		log.info('------- compiling entry pages ---------');
		packageInfo = param.packageInfo;
		bundleDepsGraph = param.bundleDepsGraph;
		config = param.config;
		revisionMeta = param.revisionMeta;
		cb();
	}, function(cb) {
		var promises = [];
		var self = this;
		log.debug(revisionMeta);
		_.forOwn(packageInfo.entryPageMap, function(instance, name) {
			log.info('Entry package ' + name);
			log.debug(instance.entryHtml);

			var prom = Q.nfcall(fs.readFile, instance.entryHtml, 'utf-8')
			.then(function(content) {
				var $ = cheerio.load(content);
				injectElements($, bundleDepsGraph[name], instance, config, revisionMeta);
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

function injectElements($, bundleSet, pkInstance, config, revisionMeta) {
	var body = $('body');
	var head = $('head');
	if (bundleSet.core) {
		// core is always the first bundle to be loaded
		_injectElementsByBundle($, head, body, 'core', config, revisionMeta);
	}

	_.forOwn(bundleSet, function(v, bundleName) {
		if (bundleName === 'core') {
			return;
		}
		_injectElementsByBundle($, head, body, bundleName, config, revisionMeta);
	});
	body.append($('<script>').html('require("' + pkInstance.longName + '");'));
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
