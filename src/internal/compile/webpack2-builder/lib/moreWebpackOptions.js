var api = require('__api');
var fs = require('fs');
var Path = require('path');
var chalk = require('chalk');
var _ = require('lodash');
var MultiEntryHtmlPlugin = require('./multi-entry-html-plugin');
var glob = require('glob');
var log = require('log4js').getLogger(api.packageName + '.' + Path.basename(__filename));
var webpack = require('webpack');
const ManualChunkPlugin = require('./manual-chunk-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
var noParseHelper = require('./noParseHelper');
var Promise = require('bluebird');
const publicPath = require('./publicPath');
const http = require('http');

var writeFileAsync = Promise.promisify(fs.writeFile.bind(fs));
//const HtmlWebpackPlugin = require('html-webpack-plugin');
const TEMP_DIR = 'webpack-temp';

exports.chunk4package = chunk4package;
exports.TEMP_DIR = TEMP_DIR;
// More customized plugins
exports.setupAsync = function(webpackConfig) {
	webpackConfig.module.noParse = api.config().browserifyNoParse ?
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

	eachComponent(
		function onComp(component) {
			noparse4Package(component, webpackConfig);
			var browserSideConfigProp = _.get(component, ['dr', 'browserSideConfigProp']);
			if (!Array.isArray(browserSideConfigProp))
				browserSideConfigProp = [browserSideConfigProp];
			_.each(browserSideConfigProp, prop => browserPropSet[prop] = true);
		},
		function onEntryComp(entryComp) {
			var bundle = chunk4package(entryComp);
			if (_.has(bundleEntryCompsMap, bundle))
				bundleEntryCompsMap[bundle].push(entryComp);
			else
				bundleEntryCompsMap[bundle] = [entryComp];

			if (!_.has(entryChunkHtmlAndView, bundle))
				entryChunkHtmlAndView[bundle] = [];

			if (!_.has(entryChunkHtmls, bundle))
				entryChunkHtmls[bundle] = [];
			eachEntryPageForComp(entryComp.entryPages, entryComp, (packagePath, pageAbsPath, pathRelPath) => {
				entryChunkHtmls[bundle].push(pageAbsPath);
				entryChunkHtmlAndView[bundle].push(pageAbsPath);
			});

			if (!_.has(entryChunkViews, bundle))
				entryChunkViews[bundle] = [];
			eachEntryPageForComp(entryComp.entryViews, entryComp, (packagePath, pageAbsPath, pathRelPath) => {
				entryViewSet[Path.relative(webpackConfig.context || process.cwd(), pageAbsPath)] = 1; // TODO: windows
				entryChunkHtmlAndView[bundle].push(pageAbsPath);
				entryChunkViews[bundle].push(pageAbsPath);
			});
		});

	var legoConfig = {}; // legoConfig is global configuration properties which apply to all entries and modules
	_.each([
		'staticAssetsURL', 'serverURL', 'packageContextPathMapping',
		'locales', 'devMode', 'assetsDirMap'
	], prop => browserPropSet[prop] = 1);
	_.each(api.config().browserSideConfigProp, prop => browserPropSet[prop] = 1);
	_.forOwn(browserPropSet, (nothing, propPath) => _.set(legoConfig, propPath, _.get(api.config(), propPath)));

	// write webpackConfig.entry
	var allWritten = _.map(bundleEntryCompsMap, (moduleInfos, bundle) => {
		return writeEntryFileForBundle(bundle, moduleInfos, entryChunkHtmls[bundle], entryChunkViews[bundle])
		.then(file => {
			webpackConfig.entry[bundle] = file;
			file2EntryChunkName[file] = bundle;
			return null;
		});
	});

	return Promise.all(allWritten).then(() => {
		return log.info('entry: %s', JSON.stringify(webpackConfig.entry, null, '  '));
	})
	.then(() => {
		// More plugins here
		addPlugins(webpackConfig, file2EntryChunkName, entryChunkHtmlAndView, entryViewSet, legoConfig);

		if (!api.config().devMode)
			webpackConfig.plugins.push(require('./gzipSizePlugin'));

		return bundleEntryCompsMap;
	});
};

function addPlugins(webpackConfig, file2EntryChunkName, entryChunkHtmlAndView, entryViewSet, legoConfig) {
	webpackConfig.plugins.push(
		new ManualChunkPlugin({
			manifest: 'runtime',
			defaultChunkName: 'common-lib',
			getChunkName: (file) => {
				var bundle = file2EntryChunkName[file];
				if (bundle)
					return bundle;
				var pk = api.findPackageByFile(file);
				if (!pk) {
					log.warn('No chunk(bundle) name for: %s', chalk.red(Path.relative(webpackConfig.context, file)));
					return null;
				}
				return chunk4package(pk);
			}
		}),
		new ExtractTextPlugin({
			filename: api.config().devMode ? '[name].css' : '[name].[contenthash:10].css'
		}),
		new MultiEntryHtmlPlugin({
			inlineChunk: 'runtime',
			entryHtml: entryChunkHtmlAndView, // key: chunkName, value: string[]
			liveReloadJs: api.config().devMode ? `http://${publicPath.getLocalIP()}:${api.config.get('livereload.port')}/livereload.js` : false
		}),
		function() {
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
					var dir = api.config.get(['entryPageMapping', component.longName]) ||
						api.config.get(['entryPageMapping', component.shortName]) || component.shortName;

					var relative = Path.relative(component.realPackagePath, htmlAssets.path);
					if (!isView)
						htmlAssets.path = Path.join(_.trimStart(dir, '/'), relative);
					else
						htmlAssets.path = Path.join('../server', _.trimStart(dir, '/'), relative);

					var stag = htmlAssets.$('<script>');
					stag.attr('type', 'text/javascript');
					stag.text('\nvar __wfhEntryPage = \'' + relative.replace(/\\/g, '/') + '\';\n' +
						'_reqLego("' + component.longName + '");\n');
					htmlAssets.$('body').append(stag);
					callback(null, htmlAssets);
				});
			});
			if (api.config.get('devMode') === true && api.config.get('livereload.enabled', true)) {
				compiler.plugin('done', function() {
					log.info('live reload page'); // tiny-lr server is started by @dr-core/browserify-builder
					sendlivereload();
				});
			}
		},
		new webpack.DefinePlugin({
			LEGO_CONFIG: JSON.stringify(legoConfig)
		})
	);
}

/**
 * @param {*} bundle
 * @param {*} packages
 * @param {*} htmlFiles string[]
 */
function writeEntryFileForBundle(bundle, packages, htmlFiles, viewFiles) {
	var buf = ['window.__req = __webpack_require__;'];
	buf.push('var _lego_entryFuncs = {};');
	[].concat(packages).forEach(package => {
		buf.push(`_lego_entryFuncs["${package.longName}"]= function() {return require("${package.longName}");}`);
	});
	buf.push(`_reqLego = function(name) {`);
	buf.push(`  return _lego_entryFuncs[name]();`);
	buf.push(`}`);
	var file = Path.resolve(api.config().destDir, TEMP_DIR, 'entry_' + bundle + '.js');
	htmlFiles.forEach(htmlFile => {
		var requireHtmlName = Path.relative(Path.dirname(file), htmlFile).replace(/\\/g, '/');
		if (!(requireHtmlName.startsWith('..') || requireHtmlName.startsWith('/')))
			requireHtmlName = './' + requireHtmlName;
		buf.push('require("!@dr-core/webpack2-builder/lib/entry-html-loader!@dr-core/webpack2-builder/lib/html-loader!@dr/translate-generator!@dr/template-builder!' + requireHtmlName + '");\n');
	});
	viewFiles.forEach(viewFiles => {
		var requireHtmlName = Path.relative(Path.dirname(file), viewFiles).replace(/\\/g, '/');
		if (!(requireHtmlName.startsWith('..') || requireHtmlName.startsWith('/')))
			requireHtmlName = './' + requireHtmlName;
		buf.push('require("!@dr-core/webpack2-builder/lib/entry-html-loader!@dr-core/webpack2-builder/lib/html-loader!' + requireHtmlName + '");\n');
	});
	log.info('write entry file %s', file);
	return writeFileAsync(file, buf.join('\n'))
	.delay(2000)
	.then(() => file);
}

function eachComponent(onComponent, onEntryComponent) {
	_.each(api.packageInfo.allModules, function(component) {
		onComponent(component);
		if ((component.entryPages || component.entryViews) && component.compiler === 'webpack') {
			if (api.argv.p != null) {
				var runNames = [].concat(api.argv.p);
				if (!_.includes(runNames, component.parsedName.name) && !_.includes(runNames, component.longName))
					return;
			}
			onEntryComponent(component);
		}
	});
}

/**
 * @param onPage function(packagePath, pageAbsPath, pathRelPath)
 */
function eachEntryPageForComp(pages, entryComp, onPage) {
	_.each(pages, page => {
		var pagePathInfo = resolvePagePath(page, entryComp, api.packageInfo.moduleMap);
		glob.sync(pagePathInfo.abs).forEach(singlePath => {
			onPage(pagePathInfo.package, singlePath, Path.relative(pagePathInfo.package, singlePath));
		});
	});
}

var npmPat = /npm:\/\/((?:@[^\/]+\/)?[^\/]+)\/(.*?$)/;
function resolvePagePath(page, instance, moduleMap) {
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

function noparse4Package(component, webpackConfig) {
	if (component.browserifyNoParse) {
		component.browserifyNoParse.forEach(function(noParseFile) {
			var item = Path.resolve(component.realPackagePath, noParseFile);
			log.debug('noParse: %s', item);
			webpackConfig.module.noParse.push(new RegExp(noParseHelper.glob2regexp(item)));
		});
	}
	var setting = _.get(component, 'dr.noParse');
	if (setting) {
		[].concat(setting).forEach(function(noParse) {
			var item = Path.resolve(component.realPackagePath, noParse);
			log.debug('noParse: %s', item);
			webpackConfig.module.noParse.push(new RegExp(noParseHelper.glob2regexp(item)));
		});
	}
}


function chunk4package(component) {
	//log.debug('%s chunk: %s', component.longName, chunk);
	return component.bundle;
}
