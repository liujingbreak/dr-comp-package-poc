var _ = require('lodash');
var fs = require('fs');
var cheerio = require('cheerio');
var Path = require('path');
var Promise = require('bluebird');
var through = require('through2');
var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
var File = require('vinyl');
//var swig = require('swig');
var api = require('__api');
var log = require('@dr/logger').getLogger(api.packageName + '.pageCompiller');
var browserBundleLoader = require('@dr-core/bundle-loader');
var glob = require('glob');
var packageUtils = api.packageUtils;

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
			if (instance.compiler && instance.compiler !== 'browserify')
				return;
			if (!needUpdateEntryPage(buildInfo.builtBundles, buildInfo.bundleDepsGraph[name])) {
				return;
			}
			var bootstrapCode = buildInfo.createEntryBootstrapCode(instance.longName, true); // load CSS by JS
			var bootstrapCodeNoCss = buildInfo.createEntryBootstrapCode(instance.longName, false); // load CSS by HTML tag
			// We prefer load CSS by insert <link> tag in HTML HEAD element,
			// which starts downloading earlier than loading by JS,
			// But we also want to output some JS fragment in case someone
			// needs to insert entry JS with loading CSS bundle all together in their entry page.
			self.push(new File({
				path: instance.shortName + '.entry.js',
				contents: new Buffer(bootstrapCode)
			}));
			if (pageType === 'static' && instance.entryPages) {
				promises.push(compiler.doEntryFiles(instance.entryPages, instance, pageType, bootstrapCodeNoCss, self));
			} else if (pageType === 'server' && instance.entryViews) {
				promises.push(compiler.doEntryFiles(instance.entryViews, instance, pageType, bootstrapCodeNoCss, self));
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

PageCompiler.prototype.doEntryFiles = function(views, entryPackage, type, bootstrapCode, through) {
	var self = this;
	var promises = [];
	views.forEach(page => {
		var pagePathInfo = resolvePagePath(page, entryPackage, self.buildInfo.packageInfo.moduleMap);
		glob.sync(pagePathInfo.abs).forEach(singlePath => {
			var singlePathInfo = _.clone(pagePathInfo);
			singlePathInfo.abs = singlePath;
			singlePathInfo.path = Path.relative(singlePathInfo.package, singlePath);
			promises.push(self.doEntryFile(singlePathInfo, entryPackage, self.buildInfo, type, through, bootstrapCode));
		});
	});
	return Promise.all(promises);
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
PageCompiler.prototype.doEntryFile = function(pathInfo, instance, buildInfo, pageType, through, bootstrapCode) {
	var compiler = this;
	//var pathInfo = resolvePagePath(page, instance, buildInfo.packageInfo.moduleMap);

	return readFileAsync(pathInfo.abs, 'utf-8')
	.then(function(content) {
		return compiler.transform(pathInfo.abs, content);
	})
	.then(content => {
		var $ = cheerio.load(content, {decodeEntities: false});
		compiler.insertElements($, buildInfo.bundleDepsGraph[instance.longName], instance,
			buildInfo.config, buildInfo.revisionMeta, pathInfo, bootstrapCode);
		var hackedHtml = $.html();
		hackedHtml = api.replaceAssetsUrl(hackedHtml, pathInfo.abs);

		var pagePath;
		var mappedTo = _.get(api.config(), ['outputPathMap', instance.shortName]) ||
			_.get(api.config(), ['outputPathMap', instance.longName]);
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

		// @Deprecated approach to make a `rootPackage` via configure property `packageContextPathMapping`
		if (pageType === 'static' && compiler.rootPackage === instance.shortName) {
			pagePath = Path.resolve(pathInfo.path);
			log.debug('copy root entry page of ' + compiler.rootPackage);
			through.push(new File({
				path: pagePath,
				contents: new Buffer(hackedHtml)
			}));
		}
		return null;
	});
};

PageCompiler.prototype.transform = function(filePath, content) {
	var self = this;
	if (Array.isArray(this.addonTransforms) && this.addonTransforms.length > 0) {
		var streams = self.addonTransforms.map(factory => factory(filePath));
		var last = streams.reduce((prev, t) => {
			return prev.pipe(t);
		});

		var newContent = '';
		return new Promise(resolve => {
			streams[0].end(content);
			last.on('data', data => newContent += data)
			.on('end', () => resolve(newContent.toString()));
		});
	}
	return Promise.resolve(content);
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

/**
 * @Deprecated
 */
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

PageCompiler.prototype.insertElements = function($, bundleSet, pkInstance, config, revisionMeta, pathInfo, bootstrapCode) {
	var body = $('body');
	var head = $('head');
	// $cssPrinter, $jsPrinter are used to output these bootstrap HTML fragment to seperate files, which
	// can be read by server-side rendering program, e.g. express res.render()
	var $cssPrinter = cheerio.load('<div></div>', {decodeEntities: false});
	var $jsPrinter = cheerio.load('<div></div>', {decodeEntities: false});

	var cssPrinterDiv = $cssPrinter('div');
	// labjs bundle
	_insertLabjsBundle($, head, body, this.buildInfo.labjsBundleMetadata, config);
	_insertLabjsBundle($, cssPrinterDiv, $jsPrinter('div'), this.buildInfo.labjsBundleMetadata, config);
	// -- Insert CSS bundle <link> tags
	var metadata = this.buildInfo.getBundleMetadataForEntry(pkInstance.longName);
	_.each(metadata.css, function(cssPath) {
		var bundleCss = createCssLinkElement($, cssPath, config);
		if (bundleCss) {
			cssPrinterDiv.append(bundleCss);
			if (head.length === 0) {
				log.warn(`Invalid Entry HTML page: ${pkInstance.longName}: ${pathInfo.path},
					missing HEAD element, CSS bundle can not be inserted automatically.
					You will need to insert CSS links by yourself`);
			}
			head.append(bundleCss.clone());
		}
	});
	log.debug('head', $cssPrinter.html());

	var jsDependencyDom = $('<script>').text(bootstrapCode);

	$jsPrinter('div').append(jsDependencyDom);
	this.entryFragmentFiles.push(new File({
		path: 'entryFragment/' + api.getBuildLocale() + '/' + pkInstance.longName + '/' + pathInfo.path + '.js.html',
		contents: new Buffer($jsPrinter.html('div *'))
	}));
	this.entryFragmentFiles.push(new File({
		path: 'entryFragment/' + api.getBuildLocale() + '/' + pkInstance.longName + '/' + pathInfo.path + '.style.html',
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

function _insertLabjsBundle($, head, body, metadata, config) {
	var bundleScript = createScriptElement($, metadata.js[0], config);
	var bundleCss = createCssLinkElement($, metadata.css[0], config);
	if (bundleScript) {
		body.append(bundleScript);
	}
	if (bundleCss) {
		head.append(bundleCss);
	}
}

function createScriptElement($, jsPath, config) {
	var scriptEl = $('<script>');
	if (!jsPath)
		return null;
	var src = browserBundleLoader.resolveBundleUrl(jsPath, config().staticAssetsURL);
	// var rs = URL_PAT.exec(src);
	// src = (rs[1] ? rs[1] : '') + rs[2].replace(/\/\/+/g, '/');
	scriptEl.attr('src', src);
	return scriptEl;
}

function createCssLinkElement($, cssPath, config) {
	var element = $('<link/>');
	if (!cssPath)
		return null;
	var src = browserBundleLoader.resolveBundleUrl(cssPath, config().staticAssetsURL);
	//var src = config().staticAssetsURL + '/' + api.localeBundleFolder() + mappedFile;
	//var rs = URL_PAT.exec(src);
	//src = (rs[1] ? rs[1] : '') + rs[2].replace(/\/\/+/g, '/');
	element.attr('rel', 'stylesheet');
	element.attr('href', src);
	element.attr('type', 'text/css');

	return element;
}
