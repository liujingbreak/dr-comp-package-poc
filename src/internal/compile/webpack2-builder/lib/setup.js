var api = require('__api');
var fs = require('fs');
var Path = require('path');
var _ = require('lodash');
var MultiEntryHtmlPlugin = require('./multi-entry-html-plugin');
var glob = require('glob');
var log = require('log4js').getLogger(api.packageName);
//const HtmlWebpackPlugin = require('html-webpack-plugin');

exports.getChunkOfPackage = getChunkOfPackage;
exports.setup = function(webpackConfig) {
	webpackConfig.module.noParse = api.config().browserifyNoParse ?
		api.config().browserifyNoParse.map(line => new RegExp('^' + line + '$')) : [];
	var entryComponents = {}; // {chunkName: string, component[]}
	var entryChunkHtmls = {};

	eachComponent(
		function onComp(component) {
			noparse4Package(component, webpackConfig);
		},
		function onEntryComp(entryComp) {
			var bundle = getChunkOfPackage(entryComp, 'dr.bundle');
			if (_.has(entryComponents, bundle)) {
				entryComponents[bundle].push(entryComp);
			} else
				entryComponents[bundle] = [entryComp];
			var htmls = entryChunkHtmls[bundle] = [];
			eachEntryPageForComp(entryComp.entryPages, entryComp, (packagePath, pageAbsPath, pathRelPath) => {
				htmls.push(pageAbsPath);
			});
			//TODO: eachEntryPageForComp(entryComp.entryViews);
		});
	log.debug('noParse: %s', webpackConfig.module.noParse);

	webpackConfig.plugins.push(new MultiEntryHtmlPlugin({
		inlineChunk: 'runtime',
		publicPath: api.config().staticAssetsURL,
		entryHtml: entryChunkHtmls
	}));
	// _.each(entryChunkHtmls, (files, entryName) => {
	// 	_.each(files, file => {
	// 		webpackConfig.plugins.push(new HtmlWebpackPlugin({
	// 			filename: file,
	// 			cache: true
	// 		}));
	// 	});
	// });
	return entryComponents;
};

function eachComponent(onComponent, onEntryComponent) {
	_.each(api.packageInfo.allModules, function(component) {
		onComponent(component);
		if ((component.entryPages || component.entryViews) && component.compiler === 'webpack') {
			onEntryComponent(component);
		}
	});
}

/**
 * @param onPage function(packagePath, pageAbsPath, pathRelPath)
 */
function eachEntryPageForComp(pages, entryComp, onPage) {
	pages.forEach(page => {
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

function noparse4Package(component, webpackConfig) {
	if (component.browserifyNoParse) {
		component.browserifyNoParse.forEach(function(noParseFile) {
			var file = Path.resolve(component.packagePath, noParseFile);
			if (fs.existsSync(file))
				file = fs.realpathSync(file);
			webpackConfig.module.noParse.push(new RegExp('^' + file + '$'));
		});
	}
}

function getChunkOfPackage(component) {
	var c = _.get(component, 'dr.chunk');
	if (c === false || c === '')
		return false;
	var chunk = c || _.get(component, 'dr.bundle') || component.bundle;
	//log.debug('%s chunk: %s', component.longName, chunk);
	return chunk;
}
