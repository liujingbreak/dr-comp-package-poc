var _ = require('lodash');
var fs = require('fs');
var cheerio = require('cheerio');
var Path = require('path');
var Q = require('q');
var Promise = require('bluebird');
var through = require('through2');
var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
var File = require('vinyl');
var swig = require('swig');
var api = require('__api');
var log = require('@dr/logger').getLogger(api.packageName + '.pageCompiller');
var packageUtils = require('@dr/environment').packageUtils;
var assetsProcesser = require('@dr-core/assets-processer');

module.exports = PageCompiler;

function PageCompiler(addonTransforms) {
	this.builderInfo = null;
	this.rootPackage = null;
	this.addonTransforms = addonTransforms;
}

/**
 * @param  {string} pageType 'server' or 'static'
 * @return {transform}          [description]
 */
PageCompiler.prototype.compile = function(pageType) {
	var compiler = this;
	return through.obj(function(param, encoding, cb) {
		log.info('------- compiling changed entry ' + pageType + ' pages ---------');
		log.info('(Only the pages which depend on any changed bundles will be replaced)');

		if (!compiler.buildInfo) {
			compiler.buildInfo  = param;
			var contextPathMapping = compiler.buildInfo.config().packageContextPathMapping;
			if (contextPathMapping) {
				compiler.rootPackage = findRootContextPackage(contextPathMapping);
			}
		}
		cb();
	}, function(cb) {
		var buildInfo = compiler.buildInfo;
		var promises = [];
		var self = this;
		_.forOwn(buildInfo.packageInfo.entryPageMap, function(instance, name) {
			if (!needUpdateEntryPage(buildInfo.builtBundles, buildInfo.bundleDepsGraph[name])) {
				return;
			}
			if (pageType === 'static' && instance.entryPages) {
				promises = promises.concat(instance.entryPages.map(page => {
					return compiler.doEntryFile(page, instance, buildInfo, 'static', self);
				}));
			}
			if (pageType === 'server' && instance.entryViews) {
				promises = promises.concat(promises, instance.entryViews.map(page => {
					return compiler.doEntryFile(page, instance, buildInfo, 'server', self);
				}));
			}
		});
		Q.all(promises).then(function() {
			cb();
		}).catch(function(err) {
			log.error(err);
			self.emit('error', new PluginError('browserifyBuilder.pageCompiler', err.stack, {showStack: true}));
		});
	} );
};

var readFileAsync = Promise.promisify(fs.readFile, {context: fs});

PageCompiler.prototype.doEntryFile = function(page, instance, buildInfo, pageType, through) {
	var compiler = this;
	var pathInfo = resolvePagePath(page, instance, buildInfo.packageInfo.moduleMap);
	var pagePath = Path.resolve(instance.shortName, pathInfo.path);
	return readFileAsync(pathInfo.abs, 'utf-8')
	.then(function(content) {
		content = compiler.transform(pathInfo.abs, content);
		var $ = cheerio.load(content);
		compiler.injectElements($, buildInfo.bundleDepsGraph[instance.longName], instance,
			buildInfo.config, buildInfo.revisionMeta, buildInfo.entryDataProvider);
		var hackedHtml = $.html();
		hackedHtml = assetsProcesser.replaceAssetsUrl(hackedHtml, ()=> {
			return pathInfo.packageName;
		});

		log.info('Entry page processed: ' + pagePath);
		through.push(new File({
			path: pagePath,
			contents: new Buffer(hackedHtml)
		}));
		if (pageType === 'static' && compiler.rootPackage === instance.shortName) {
			pagePath = Path.resolve(pathInfo.path);
			log.debug('copy root entry page of ' + compiler.rootPackage);
			through.push(new File({
				path: pagePath,
				contents: new Buffer(hackedHtml)
			}));
		}
	});
};

PageCompiler.prototype.transform = function(filePath, content) {
	if (Array.isArray(this.addonTransforms) && this.addonTransforms.length > 0) {
		this.addonTransforms.forEach(transform => {
			var thr = transform(filePath);
			thr.write(content);
			thr.end();
			content = thr.read().toString();
		});
	}
	return content;
};

var npmPat = /npm:\/\/((?:@[^\/]+\/)?[^\/]+)\/(.*?$)/;

function resolvePagePath(page, instance, moduleMap) {
	if (page.startsWith('npm://')) {
		var matched = npmPat.exec(page.replace(/\\/g, '/'));
		var packageName = matched[1];
		var path = matched[2];
		return {
			packageName: packageName,
			package: moduleMap[packageName].packagePath,
			path: path,
			abs: Path.resolve(moduleMap[packageName].packagePath, path)
		};
	} else {
		return {
			packageName: instance.longName,
			package: instance.packagePath,
			path: page,
			abs: Path.resolve(instance.packagePath, page)
		};
	}
}

function findRootContextPackage(mapping) {
	var rootPackage;
	_.some(mapping, function(path, name) {
		if (path === '/') {
			rootPackage = packageUtils.parseName(name).name;
			return true;
		}
		return false;
	});
	return rootPackage;
}

function needUpdateEntryPage(builtBundles, bundleSet) {
	return builtBundles.some(function(bundleName) {
		return {}.hasOwnProperty.call(bundleSet, bundleName);
	});
}

var entryBootstrapTpl = swig.compileFile(Path.join(__dirname, 'templates', 'entryPageBootstrap.js.swig'), {autoescape: false});

PageCompiler.prototype.injectElements = function($, bundleSet, pkInstance, config, revisionMeta, entryDataProvider) {
	var body = $('body');
	var head = $('head');
	_injectElementsByBundle($, head, body, 'labjs', config, revisionMeta);
	delete bundleSet.labjs; // make sure there is no duplicate labjs bundle
	var loadingData = this.buildInfo.getBundleMetadataForEntry(pkInstance.longName);
	_.forOwn(bundleSet, function(v, bundleName) {
		var bundleCss = createCssLinkElement($, bundleName, config, revisionMeta);
		if (bundleCss) {
			head.append(bundleCss);
		}
	});
	var entryData = entryDataProvider(pkInstance.longName);
	body.append($('<script>').text(entryBootstrapTpl({
		jsPaths: JSON.stringify(loadingData.js),
		staticAssetsURL: config().staticAssetsURL,
		//jsLinks: jsLinks,
		entryPackage: pkInstance.longName,
		debug: !!config().devMode,
		data: config().devMode ? JSON.stringify(entryData, null, '  ') : JSON.stringify(entryData)
	})));
};

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
	var mappedFile = revisionMeta ? revisionMeta[file] : file;
	if (!mappedFile) {
		return null;
	}
	log.trace(file + ' -> ' + mappedFile);
	var src = config().staticAssetsURL + '/' + mappedFile;
	var rs = URL_PAT.exec(src);
	src = (rs[1] ? rs[1] : '') + rs[2].replace(/\/\/+/g, '/');
	scriptEl.attr('src', src);
	return scriptEl;
}

function createCssLinkElement($, bundleName, config, revisionMeta) {
	var element = $('<link/>');
	var file = 'css/' + bundleName + '.css';
	var mappedFile = revisionMeta ? revisionMeta[file] : file;
	if (!mappedFile) {
		return null;
	}
	log.trace(file + ' -> ' + mappedFile);
	var src = config().staticAssetsURL + '/' + mappedFile;
	var rs = URL_PAT.exec(src);
	src = (rs[1] ? rs[1] : '') + rs[2].replace(/\/\/+/g, '/');
	element.attr('rel', 'stylesheet');
	element.attr('href', src);
	element.attr('type', 'text/css');

	return element;
}
