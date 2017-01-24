var webpack = require('webpack');
var api = require('__api');
var _ = require('lodash');
var fs = require('fs');
var Path = require('path');
var log = require('log4js').getLogger(api.packageName);
const ManualChunkPlugin = require('./manual-chunk-plugin');
//const HtmlWebpackPlugin = require('html-webpack-plugin');
const publicDir = '/wp/';

var webpackConfig = {
	context: api.config().rootPath,
	entry: {
		example: '@dr/example-webpack',
		example2: '@dr/example-webpack-dependency',
		//partial: '@dr/example-partial'
		//lodash: 'lodash'
	},
	output: {
		filename: '[name].[chunkhash].js',
		publicPath: api.config().staticAssetsURL + publicDir
	},
	module: {
		noParse: null,
		rules: [
			{
				test: /\.js$/,
				use: [
					{loader: '@dr-core/webpack2-builder/api-loader'}
				]
			},
			{
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
	// externals: {
	// 	'@dr/example-partial': {
	// 		commonjs: '@dr/example-partial',
	// 		commonjs2: '@dr/example-partial'
	// 	}
	// },
	plugins: [
		// new webpack.optimize.CommonsChunkPlugin({
		// 	names: ['common', 'init'], // Specify the common bundle's name.
		// 	minChunks: 2,
		// 	async: true
		// 	//children: true
		// }),
		new ManualChunkPlugin(),
		// new HtmlWebpackPlugin({
		// 	filename: 'auto.html'
		// }),
		// new webpack.ProvidePlugin({
		// 	__api: '@dr-core/browserify-builder-api'
		// }),

	]
};

exports.compile = (api) => {
	if (api.config().devMode)
		webpackConfig.output.filename = '[name].js';
	webpackConfig.module.noParse = api.config().browserifyNoParse ?
		api.config().browserifyNoParse.map(line => new RegExp('^' + line + '$')) : [];

	_.each(api.packageInfo.allModules, function(moduleInfo) {
		if (moduleInfo.browserifyNoParse) {
			moduleInfo.browserifyNoParse.forEach(function(noParseFile) {
				var file = Path.resolve(moduleInfo.packagePath, noParseFile);
				if (fs.existsSync(file))
					file = fs.realpathSync(file);
				webpackConfig.module.noParse.push(new RegExp('^' + file + '$'));
			});
		}
	});
	log.debug('noParse: %s', webpackConfig.module.noParse);
	return gulp.src('.')
		.pipe(webpackStream(webpackConfig, webpack))
		.pipe(gulp.dest(api.config().staticDir + publicDir));
};
