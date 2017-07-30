var api = require('__api');
var fs = require('fs');
var Path = require('path');
var _ = require('lodash');
var glob = require('glob');
var log = require('log4js').getLogger('wfh.' + Path.basename(__filename));
var noParseHelper = require('./noParseHelper');
var pify = require('pify');
//var chalk = require('chalk');
const http = require('http');
const DependencyHelper = require('./utils/module-dep-helper');

var writeFileAsync = pify(fs.writeFile.bind(fs));
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
	var file2EntryChunk = {};
	var webpackConfigEntry = {};
	var entryComponents = [];

	_eachComponent(
		function onComp(component) {
			noparse4Package(component, noParse);
			var browserSideConfigProp = _.get(component, ['dr', 'browserSideConfigProp']);
			if (browserSideConfigProp != null && !Array.isArray(browserSideConfigProp)) {
				browserSideConfigProp = [browserSideConfigProp];
			}
			if (browserSideConfigProp)
				log.debug('Found "dr.browserSideConfigProp" in %s, %s', component.longName, browserSideConfigProp);
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
	_.each(api.config().browserSideConfigProp, prop => browserPropSet[prop] = true);
	_.forOwn(browserPropSet, (nothing, propPath) => _.set(legoConfig, propPath, _.get(api.config(), propPath)));
	var compressedInfo = compressOutputPathMap(legoConfig.outputPathMap);
	legoConfig.outputPathMap = compressedInfo.diffMap;
	legoConfig._outputAsNames = compressedInfo.sames;
	legoConfig.buildLocale = api.getBuildLocale();
	log.info('DefinePlugin LEGO_CONFIG: ', legoConfig);

	// write webpackConfig.entry
	_.each(bundleEntryCompsMap, (moduleInfos, bundle) => {
		var file = Path.resolve(api.config().destDir, TEMP_DIR, 'entry_' + bundle + '.js');
		webpackConfigEntry[bundle] = file;
		file2EntryChunk[file] = bundle;
	});

	var autoImportFile2Chunk = require('./utils/auto-import.js');
	return {
		params: [webpackConfigEntry, noParse, _.assign(autoImportFile2Chunk, file2EntryChunk), entryChunkHtmlAndView, legoConfig, chunk4package,
			sendlivereload, createEntryHtmlOutputPathPlugin(entryViewSet),
			function() {
				return entryHtmlCssScopePlugin.call(this, new DependencyHelper(entryComponents));
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
				if (!isView) {
					htmlAssets.path = Path.join(_.trimStart(dir, '/'), relative);
				} else
					htmlAssets.path = Path.join('../server', _.trimStart(dir, '/'), relative);

				var stag = htmlAssets.$('<script>');
				stag.attr('type', 'text/javascript');
				stag.text(`
				var __drcpEntryPage = '${relative.replace(/\\/g, '/')}';
					__drcpEntryPackage = '${component.longName}';
					_reqLego('${component.longName}');
					`);
				htmlAssets.$('body').append(stag);
				callback(null, htmlAssets);
			});
		});
	};
}

/**
 * For CSS scope, add pacakge short name as class name to HTML element during server rendering
 */
function entryHtmlCssScopePlugin(moduleDep) {
	var depInfo;
	this.plugin('after-emit', function(compilation, callback) {
		depInfo = null;
		// log.debug('clean listCommonJsDepMap');
		// log.debug('Components have css scope %s', api.compsHaveCssScope);
		// log.debug('Components have css %s', Object.keys(api.compsHaveCssSet));
		callback();
	});
	this.plugin('compilation', function(compilation) {
		if (compilation.compiler.parentCompilation)
			return;
		compilation.plugin('optimize', function() {
			if (!depInfo)
				depInfo = moduleDep.listCommonJsDepMap(compilation);
		});
		// var needUnseal = true;
		// compilation.plugin('need-additional-seal', function() {
		// 	var n = needUnseal;
		// 	needUnseal = false;
		// 	return n;
		// });
		compilation.plugin('multi-entry-html-emit-assets', (assets, cb) => {
			var html = assets.$('html');
			var comp = api.findPackageByFile(assets.absPath);
			if (comp && _.get(comp, 'dr.cssScope') !== false) {
				var cls = _.get(comp, 'dr.cssScope');
				html.addClass(_.isString(cls) ? cls : comp.shortName);
				if (!depInfo)
					depInfo = moduleDep.listCommonJsDepMap(compilation);
				for (let depComp of depInfo.cssPackageMap.get(comp.longName)) {
					let cls = _.get(depComp.longName, 'dr.cssScope');
					html.addClass(_.isString(cls) ? cls : depComp.shortName.replace('.', '_'));
				}
			}
			cb(null, assets);
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
		[].concat(setting).forEach(function(noParseFile) {
			var item = Path.resolve(component.realPackagePath, noParseFile);
			log.debug('noParse: %s', item);
			noParse.push(new RegExp(noParseHelper.glob2regexp(item)));
		});
	}
}


function chunk4package(component) {
	//log.debug('%s chunk: %s', component.longName, chunk);
	return component.bundle;
}

function compressOutputPathMap(pathMap) {
	var newMap = {};
	var sameAsNames = [];
	_.each(pathMap, (value, key) => {
		var parsed = api.packageUtils.parseName(key);
		if (parsed.name !== value) {
			newMap[key] = value;
		} else {
			sameAsNames.push(key);
		}
	});
	return {
		sames: sameAsNames,
		diffMap: newMap
	};
}
