var _ = require('lodash');
var fs = require('fs');
var cheerio = require('cheerio');
var Path = require('path');
var Promise = require('bluebird');
var through = require('through2');
var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
var File = require('vinyl');
var swig = require('swig');
var api = require('__api');
var log = require('@dr/logger').getLogger(api.packageName + '.pageCompiller');
var packageUtils = api.packageUtils;
var assetsProcesser = require('@dr-core/assets-processer');

module.exports = PageCompiler;
/**
 * Entry Page Compilation transform
 */
function PageCompiler(addonTransforms) {
	this.builderInfo = null;
	this.rootPackage = null;
	this.addonTransforms = addonTransforms;
	this.entryFragmentFiles = [];
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
			var contextPathMapping = api.config().packageContextPathMapping;
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
		Promise.all(promises).then(function() {
			cb();
		}).catch(function(err) {
			log.error(err);
			self.emit('error', new PluginError('browserifyBuilder.pageCompiler', err.stack, {showStack: true}));
		});
	} );
};

var readFileAsync = Promise.promisify(fs.readFile, {context: fs});
/**
 * [doEntryFile description]
 * @param  {[type]} page      [description]
 * @param  {[type]} instance  PackageBrowserInstance
 * @param  {[type]} buildInfo [description]
 * @param  {[type]} pageType  [description]
 * @param  {[type]} through   [description]
 * @return {[type]}           [description]
 */
PageCompiler.prototype.doEntryFile = function(page, instance, buildInfo, pageType, through) {
	var compiler = this;
	var pathInfo = resolvePagePath(page, instance, buildInfo.packageInfo.moduleMap);

	return readFileAsync(pathInfo.abs, 'utf-8')
	.then(function(content) {
		content = compiler.transform(pathInfo.abs, content);
		var $ = cheerio.load(content);
		compiler.injectElements($, buildInfo.bundleDepsGraph[instance.longName], instance,
			buildInfo.config, buildInfo.revisionMeta, buildInfo.entryDataProvider, pathInfo);
		var hackedHtml = $.html();
		hackedHtml = assetsProcesser.replaceAssetsUrl(hackedHtml, ()=> {
			return pathInfo.packageName;
		});

		var pagePath;
		var mappedTo = _.get(api.config(), ['entryPageMapping', instance.shortName]) || _.get(api.config(), ['entryPageMapping', instance.longName]);
		if (mappedTo) {
			if (mappedTo === '/')
				pagePath = Path.resolve(pathInfo.path);
			else {
				mappedTo = mappedTo.startsWith('/') ? mappedTo.substring(1) : mappedTo;
				pagePath = Path.resolve(mappedTo, pathInfo.path);
			}
		} else {
			pagePath = Path.resolve(instance.shortName, pathInfo.path);
		}
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

PageCompiler.prototype.injectElements = function($, bundleSet, pkInstance, config, revisionMeta, entryDataProvider, pathInfo) {
	var body = $('body');
	var head = $('head');
	// $cssPrinter, $jsPrinter are used to output these bootstrap HTML fragment to seperate files, which
	// can be read by server-side rendering program, e.g. express res.render()
	var $cssPrinter = cheerio.load('<div></div>');
	var $jsPrinter = cheerio.load('<div></div>');

	var cssPrinterDiv = $cssPrinter('div');
	_injectElementsByBundle($, head, body, 'labjs', config, revisionMeta);
	_injectElementsByBundle($, cssPrinterDiv, $jsPrinter('div'), 'labjs', config, revisionMeta);
	delete bundleSet.labjs; // make sure there is no duplicate labjs bundle

	var loadingData = this.buildInfo.getBundleMetadataForEntry(pkInstance.longName);
	_.forOwn(bundleSet, function(v, bundleName) {
		var bundleCss = createCssLinkElement($, bundleName, config, revisionMeta);
		if (bundleCss) {
			cssPrinterDiv.append(bundleCss);
			head.append(bundleCss.clone());
		}
	});
	log.debug('head', $cssPrinter.html());
	var entryData = entryDataProvider(pkInstance.longName);
	var bootstrapCode = entryBootstrapTpl({
		jsPaths: JSON.stringify(loadingData.js, null, '  '),
		staticAssetsURL: config().staticAssetsURL,
		entryPackage: pkInstance.longName,
		debug: !!config().devMode,
		data: JSON.stringify(entryData, null, '  ')
	});
	var jsDependencyDom = $('<script>').text(config().devMode ?
		bootstrapCode : require('uglify-js').minify(bootstrapCode, {fromString: true}).code);

	$jsPrinter('div').append(jsDependencyDom);
	this.entryFragmentFiles.push(new File({
		path: 'entryFragment/' + pkInstance.longName + '/' + pathInfo.path + '.js.html',
		contents: new Buffer($jsPrinter.html('div *'))
	}));
	this.entryFragmentFiles.push(new File({
		path: 'entryFragment/' + pkInstance.longName + '/' + pathInfo.path + '.style.html',
		contents: new Buffer($cssPrinter.html('div *'))
	}));
	body.append(jsDependencyDom.clone());
};

PageCompiler.prototype.dependencyApiData = function() {
	var self = this;
	return through.obj(function(param, encoding, cb) {
		cb();
	}, function(cb) {
		var entryFragmentFiles = self.entryFragmentFiles;
		self.entryFragmentFiles = [];
		entryFragmentFiles.forEach(file => this.push(file));
		cb();
	});
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
