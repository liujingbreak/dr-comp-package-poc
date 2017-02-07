var gulp = require('gulp');
var webpackStream = require('webpack-stream');
var webpack = require('webpack');
var api = require('__api');
var _ = require('lodash');
var fs = require('fs');
var Path = require('path');
var mkdirp = require('mkdirp');
var log = require('log4js').getLogger(api.packageName);
const ManualChunkPlugin = require('./manual-chunk-plugin');
const setup = require('./lib/setup').setup;
const publicDir = '/wp/';

var webpackConfig = {
	context: api.config().rootPath,
	entry: {},
	output: {
		filename: '[name].[chunkhash].js',
		publicPath: api.config().staticAssetsURL + publicDir,
		// libraryTarget: 'umd'
	},
	module: {
		noParse: null,
		rules: [
			{
				test: /\.js$/,
				use: [
					{loader: '@dr-core/webpack2-builder/api-loader'}
				]
			}, {
				test: /\.html$/,
				use: [
					{loader: 'html-loader'},
					//{loader: 'swig-template-loader'}
				]
			}, {
				test: /\.txt$/,
				use: {loader: 'raw-loader'}
			}, {
				test: /\.(yaml|yml)$/,
				use: [
					{loader: 'json-loader'},
					{loader: 'yaml-loader'}
				]
			}
		]
	},
	plugins: [
		new ManualChunkPlugin({
			manifest: 'runtime'
		})
	]
};

exports.compile = (api) => {
	if (api.config().devMode) {
		webpackConfig.output.filename = '[name].js';
		webpackConfig.plugins.push(new webpack.NamedModulesPlugin());
	} else {
		webpackConfig.plugins.push(new webpack.HashedModuleIdsPlugin());
	}

	mkdirp.sync(api.config.resolve('destDir', 'webpack-temp'));

	var entryComponents = setup(webpackConfig);
	_.each(entryComponents, (moduleInfos, bundle) => {
		webpackConfig.entry[bundle] = writeEntryFileForBundle(bundle, moduleInfos);
	});
	log.debug('entry: %s', JSON.stringify(webpackConfig.entry));

	return gulp.src('.')
		.pipe(webpackStream(webpackConfig, webpack))
		.pipe(gulp.dest(api.config().staticDir + publicDir));
};

function writeEntryFileForBundle(bundle, packages) {
	var buf = [];
	buf.push('var _lego_entryFuncs = {};');
	[].concat(packages).forEach(package => {
		buf.push(`_lego_entryFuncs["${package.longName}"]= function() {return require("${package.longName}");}`);
	});
	buf.push(`_reqLego = function(name) {`);
	buf.push(`  return _lego_entryFuncs[name]();`);
	buf.push(`}`);
	var file = Path.resolve(api.config().destDir, 'webpack-temp', 'entry_' + bundle + '.js');
	fs.writeFileSync(file, buf.join('\n'));
	return file;
}
