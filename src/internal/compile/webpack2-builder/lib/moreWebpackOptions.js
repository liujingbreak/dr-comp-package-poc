var api = require('__api');
var fs = require('fs');
var Path = require('path');
var _ = require('lodash');
var glob = require('glob');
var log = require('log4js').getLogger(api.packageName + '.' + Path.basename(__filename));
var noParseHelper = require('./noParseHelper');
var Promise = require('bluebird');
const http = require('http');
const DependencyHelper = require('./utils/module-dep-helper');

var writeFileAsync = Promise.promisify(fs.writeFile.bind(fs));
//const HtmlWebpackPlugin = require('html-webpack-plugin');
const TEMP_DIR = 'webpack-temp';

exports.chunk4package = chunk4package;
exports.TEMP_DIR = TEMP_DIR;
// More customized plugins
exports.createParams = function(contextPath) {
	var noParse = api.config().browserifyNoParse ?
		api.config().browserifyNoParse.map(line => {
			var packagePath = api.packageUtils.findBrowserPackagePath(line);
			log.debug('noParse: %s', packagePath + '/**/*');
			return new RegExp(noParseHelper.glob2regexp(packagePath + '/**/*'));
		}) : [];

	var bundleEntryCompsMap = {}; // {chunkName: string, component[]}
	var entryChunkHtmls = {}; // entryPage
	var entryChunkViews = {}; // entryView
	var entryViewSet = {};
	var entryChunkHtmlAndView = {};
	var browserPropSet = {};
	var file2EntryChunkName = {};
	var webpackConfigEntry = {};
	var entryComponents = [];

	_eachComponent(
		function onComp(component) {
			noparse4Package(component, noParse);
			var browserSideConfigProp = _.get(component, ['dr', 'browserSideConfigProp']);
			if (browserSideConfigProp != null && !Array.isArray(browserSideConfigProp))
				browserSideConfigProp = [browserSideConfigProp];
			_.each(browserSideConfigProp, prop => browserPropSet[prop] = true);
		},
		function onEntryComp(entryComp) {
			entryComponents.push(entryComp);
			var bundle = chunk4package(entryComp);
			if (_.has(bundleEntryCompsMap, bundle))
				bundleEntryCompsMap[bundle].push(entryComp);
			else
				bundleEntryCompsMap[bundle] = [entryComp];

			if (!_.has(entryChunkHtmlAndView, bundle))
				entryChunkHtmlAndView[bundle] = [];

			if (!_.has(entryChunkHtmls, bundle))
				entryChunkHtmls[bundle] = [];
			_eachEntryPageForComp(entryComp.entryPages, entryComp, (packagePath, pageAbsPath, pathRelPath) => {
				entryChunkHtmls[bundle].push(pageAbsPath);
				entryChunkHtmlAndView[bundle].push(pageAbsPath);
			});

			if (!_.has(entryChunkViews, bundle))
				entryChunkViews[bundle] = [];
			_eachEntryPageForComp(entryComp.entryViews, entryComp, (packagePath, pageAbsPath, pathRelPath) => {
				entryViewSet[Path.relative(contextPath || process.cwd(), pageAbsPath)] = 1; // TODO: windows
				entryChunkHtmlAndView[bundle].push(pageAbsPath);
				entryChunkViews[bundle].push(pageAbsPath);
			});
		});

	var legoConfig = {}; // legoConfig is global configuration properties which apply to all entries and modules
	_.each([
		'staticAssetsURL', 'serverURL', 'packageContextPathMapping',
		'locales', 'devMode', 'outputPathMap'
	], prop => browserPropSet[prop] = 1);
	_.each(api.config().browserSideConfigProp, prop => browserPropSet[prop] = 1);
	_.forOwn(browserPropSet, (nothing, propPath) => _.set(legoConfig, propPath, _.get(api.config(), propPath)));
	legoConfig.buildLocale = api.getBuildLocale();
	log.info('DefinePlugin LEGO_CONFIG: ', legoConfig);

	// write webpackConfig.entry
	_.each(bundleEntryCompsMap, (moduleInfos, bundle) => {
		var file = Path.resolve(api.config().destDir, TEMP_DIR, 'entry_' + bundle + '.js');
		webpackConfigEntry[bundle] = file;
		file2EntryChunkName[file] = bundle;
	});

	return {
		params: [webpackConfigEntry, noParse, file2EntryChunkName, entryChunkHtmlAndView, legoConfig, chunk4package,
			sendlivereload, createEntryHtmlOutputPathPlugin(entryViewSet),
			function() {
				return entryHtmlCompilePlugin.call(this, new DependencyHelper(entryComponents));
			}],

		writeEntryFileAync: function(moduleRules) {
			var allWritten = _.map(bundleEntryCompsMap, (moduleInfos, bundle) => {
				return writeEntryFileForBundle(bundle, moduleInfos, entryChunkHtmls[bundle], entryChunkViews[bundle], moduleRules);
			});
			return Promise.all(allWritten).then(() => {
				return log.info('entry: %s', JSON.stringify(webpackConfigEntry, null, '  '));
			});
		}
	};
};

var entryJsTemplate = _.template(fs.readFileSync(
	Path.join(__dirname, 'entry.js.tmpl'), 'utf8'));

var excludeEntryPageLoaders = {
	'html-loader': 1
};
var excludeEntryViewLoaders = {
	'html-loader': 1,
	'@dr/template-builder': 1,
	'@dr/translate-generator': 1
};
/**
 * @param {*} bundle
 * @param {*} packages
 * @param {*} htmlFiles string[]
 */
function writeEntryFileForBundle(bundle, packages, htmlFiles, viewFiles, rules) {
	var file = Path.resolve(api.config().destDir, TEMP_DIR, 'entry_' + bundle + '.js');
	var htmlLoaderStr4Type = {};
	var requireHtmlNames = htmlFiles.map(eachHtmlName(excludeEntryPageLoaders));
	var requireViewNames = viewFiles.map(eachHtmlName(excludeEntryViewLoaders));

	function eachHtmlName(excludeLoades) {
		return function(htmlFile) {
			var ext = Path.extname(htmlFile);
			var htmlLoaderStr = htmlLoaderStr4Type[ext];
			if (!htmlLoaderStr) {
				var htmlRule = _.find(rules, rule => (rule.test instanceof RegExp) && rule.test.toString() === '/\\' + ext + '$/');
				htmlLoaderStr = '!lib/entry-html-loader';
				_.each(htmlRule.use, loader => {
					if (_.isString(loader) && _.has(excludeLoades, loader) || _.has(excludeLoades, loader.loader))
						return;
					htmlLoaderStr += '!' + (loader.loader ? loader.loader : loader);
				});
				htmlLoaderStr4Type[ext] = htmlLoaderStr;
			}

			var requireHtmlName = Path.relative(Path.dirname(file), htmlFile).replace(/\\/g, '/');
			if (!(requireHtmlName.startsWith('..') || requireHtmlName.startsWith('/')))
				requireHtmlName = './' + requireHtmlName;
			return htmlLoaderStr + '!' + requireHtmlName;
		};
	}

	log.info('write entry file %s', file);
	return writeFileAsync(file, entryJsTemplate({
		packages: packages,
		requireHtmlNames: requireHtmlNames,
		requireViewNames: requireViewNames,
		lrEnabled: api.config.get('devMode'),
		lrPort: api.config.get('livereload.port')
	}))
	.then(() => file);
}

function _eachComponent(onComponent, onEntryComponent) {
	_.each(api.packageInfo.allModules, function(component) {
		onComponent(component);
		if ((component.entryPages || component.entryViews) && component.browser/* && component.compiler === 'webpack'*/) {
			if (api.argv.p != null) {
				var runNames = [].concat(api.argv.p);
				if (!_.includes(runNames, component.parsedName.name) && !_.includes(runNames, component.longName))
					return;
			}
			if (!chunk4package(component)) {
				log.warn('No chunk configured for entry component %s', component.longName);
			}
			onEntryComponent(component);
		}
	});
}

exports.createEntryHtmlOutputPathPlugin = createEntryHtmlOutputPathPlugin;
/**
 * Change output path for each package's entry page or entry view (server render template)
 */
function createEntryHtmlOutputPathPlugin(entryViewSet) {
	return function() {
		var compiler = this;
		compiler.plugin('compilation', function(compilation) {
			compilation.plugin('multi-entry-html-emit-assets', function(htmlAssets, callback) {
				log.debug('htmlAssets.path: %s', htmlAssets.path);
				var isView = false;
				if (_.has(entryViewSet, htmlAssets.path)) {
					log.info('Entry view: %s', htmlAssets.path);
					isView = true;
				}
				var component = api.findPackageByFile(Path.resolve(compiler.options.context, htmlAssets.path));
				var dir = api.config.get(['outputPathMap', component.longName]);
				if (dir == null)
					dir = api.config.get(['outputPathMap', component.shortName]);
				if (dir == null)
					dir = component.shortName;

				var relative = Path.relative(component.realPackagePath, htmlAssets.path);
				if (!isView)
					htmlAssets.path = Path.join(_.trimStart(dir, '/'), relative);
				else
					htmlAssets.path = Path.join('../server', _.trimStart(dir, '/'), relative);

				var stag = htmlAssets.$('<script>');
				stag.attr('type', 'text/javascript');
				stag.text('\nvar __drcpEntryPage = \'' + relative.replace(/\\/g, '/') + '\';\n' +
					'_reqLego("' + component.longName + '");\n');
				htmlAssets.$('body').append(stag);
				callback(null, htmlAssets);
			});
		});
	};
}

/**
 * For CSS scope, add pacakge short name as class name to HTML element during server rendering
 */
function entryHtmlCompilePlugin(moduleDep) {
	var map;
	this.plugin('after-emit', function(compilation, callback) {
		map = null;
		log.info('clean listCommonJsDepMap');
		callback();
	});
	this.plugin('compilation', function(compilation) {
		compilation.plugin('multi-entry-html-compile-html', (file, $, cb) => {
			var html = $('html');
			var comp = api.findPackageByFile(file);
			if (comp) {
				html.addClass(comp.shortName);
				if (!map)
					map = moduleDep.listCommonJsDepMap(compilation);
				for (let depComp of map.get(comp.longName)) {
					html.addClass(depComp.shortName);
				}
			}
			cb();
		});
	});
}

/**
 * @param onPage function(packagePath, pageAbsPath, pathRelPath)
 */
function _eachEntryPageForComp(pages, entryComp, onPage) {
	_.each(pages, page => {
		var pagePathInfo = _resolvePagePath(page, entryComp, api.packageInfo.moduleMap);
		glob.sync(pagePathInfo.abs).forEach(singlePath => {
			onPage(pagePathInfo.package, singlePath, Path.relative(pagePathInfo.package, singlePath));
		});
	});
}

var npmPat = /npm:\/\/((?:@[^\/]+\/)?[^\/]+)\/(.*?$)/;
function _resolvePagePath(page, instance, moduleMap) {
	if (page.startsWith('npm://')) {
		var matched = npmPat.exec(page.replace(/\\/g, '/'));
		var packageName = matched[1];
		var path = matched[2];
		return {
			packageName: packageName,
			package: moduleMap[packageName].realPackagePath,
			path: path,
			abs: Path.resolve(moduleMap[packageName].realPackagePath, path)
		};
	} else {
		return {
			packageName: instance.longName,
			package: instance.realPackagePath,
			path: page,
			abs: Path.resolve(instance.realPackagePath, page)
		};
	}
}

function sendlivereload() {
	//var changedFile = argv['only-css'] ? 'yyy.css' : 'xxx.js';
	return new Promise((resolve, reject) => {
		var req = http.request({
			method: 'GET',
			hostname: 'localhost',
			port: api.config.get('livereload.port'),
			path: '/changed?files=xxx.js'
		}, response => {
			response.on('data', (chunk) => {
				log.info(chunk.toString('utf8'));
			});
			response.resume();
			response.on('end', () => resolve());
		})
		.on('error', err => resolve()); // Never mind, server is not on.
		req.end();
	});
}

function noparse4Package(component, noParse) {
	if (component.browserifyNoParse) {
		component.browserifyNoParse.forEach(function(noParseFile) {
			var item = Path.resolve(component.realPackagePath, noParseFile);
			log.debug('noParse: %s', item);
			noParse.push(new RegExp(noParseHelper.glob2regexp(item)));
		});
	}
	var setting = _.get(component, 'dr.noParse');
	if (setting) {
		[].concat(setting).forEach(function(noParse) {
			var item = Path.resolve(component.realPackagePath, noParse);
			log.debug('noParse: %s', item);
			noParse.push(new RegExp(noParseHelper.glob2regexp(item)));
		});
	}
}


function chunk4package(component) {
	//log.debug('%s chunk: %s', component.longName, chunk);
	return component.bundle;
}
