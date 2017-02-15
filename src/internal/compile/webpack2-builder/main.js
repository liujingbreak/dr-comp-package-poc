// var gulp = require('gulp');
// var webpackStream = require('webpack-stream');
const webpack = require('webpack');
const api = require('__api');
const mkdirp = require('mkdirp');
const Tapable = require('tapable');
const _ = require('lodash');
const log = require('log4js').getLogger(api.packageName);
const publicPath = require('./lib/publicPath');
const Promise = require('bluebird');
const moreWebpackOptions = require('./lib/moreWebpackOptions.js');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
//const LiveReloadPlugin = require('webpack-livereload-plugin');

const tapable = new Tapable();

const cssAutoPrefixSetting = {
	browsers: [
		'ie >= 8',
		'ff >= 30',
		'chrome >= 34',
		'safari >= 7',
		'ios >= 7',
		'android >= 4.0'
	]
};

function createWebpackConfig() {
	return {
		context: api.config().rootPath,
		entry: {},
		output: {
			filename: api.config().devMode ? '[name].js' : '[name].[chunkhash:10].js',
			// https://webpack.js.org/loaders/style-loader/
			// We must provide complete protocal:hostname:port, because of blob URL issue of style-loader
			//
			// Note about source maps support and assets referenced with url: when style loader is used
			// with ?sourceMap option, the CSS modules will be generated as Blobs, so relative paths
			// don't work (they would be relative to chrome:blob or chrome:devtools).
			// In order for assets to maintain correct paths setting output.publicPath property of
			// webpack configuration must be set, so that absolute paths are generated.
			publicPath: publicPath(),
			path: api.config.resolve('staticDir')
		},
		watch: false,
		module: {
			noParse: null,
			rules: [
				{
					test: /\.js$/,
					use: [
						{loader: '@dr/translate-generator'},
						{loader: '@dr-core/webpack2-builder/lib/api-loader', options: {injector: api.browserInjector}}
					],
					parser: {
						amd: false // Do not parse some 3rd-party library as AMD module, like GSAP will fail in AMD module mode
					}
				}, {
					test: /\.html$/,
					use: [
						{loader: 'html-loader', options: {attrs: 'img:src'}},
						{loader: '@dr-core/webpack2-builder/lib/html-loader'}, // Replace keyward assets:// in *[src|href]
						{loader: '@dr/translate-generator'},
						{loader: '@dr/template-builder'}
					]
				}, {
					test: /\.css$/,
					use: ExtractTextPlugin.extract({
						fallback: 'style-loader',
						use: [
							{loader: 'css-loader', options: {
								minimize: !api.config().devMode,
								sourceMap: api.config().enableSourceMaps,
								importLoaders: 3
							}},
							{
								loader: 'autoprefixer-loader',
								options: cssAutoPrefixSetting
							},
							{loader: '@dr-core/webpack2-builder/lib/css-url-assets-loader'},
							{loader: '@dr-core/webpack2-builder/lib/npmimport-css-loader'}
						]
					})
				}, {
					test: /\.less$/,
					use: ExtractTextPlugin.extract({
						fallback: 'style-loader',
						use: [
							{loader: 'css-loader', options: {
								minimize: !api.config().devMode,
								sourceMap: api.config().enableSourceMaps,
								importLoaders: 3
							}},
							{
								loader: 'autoprefixer-loader',
								options: cssAutoPrefixSetting
							},
							{loader: '@dr-core/webpack2-builder/lib/css-url-assets-loader'},
							// less-loader sucks, too buggy to use
							{loader: '@dr/less-loader', options: {sourceMap: false}},
							{loader: '@dr-core/webpack2-builder/lib/npmimport-css-loader'}
						]
					})
				},{
					test: /\.txt$/,
					use: {loader: 'raw-loader'}
				}, {
					test: /\.(yaml|yml)$/,
					use: [
						{loader: 'json-loader'},
						{loader: 'yaml-loader'}
					]
				}, {
					test: /\.(jpg|png|gif|svg|jpeg)$/,
					use: [{loader: 'file-loader', options: {
						name: '[path][name].[md5:hash:hex:8].[ext]'
					}}]
				}
			]
		},
		resolve: {
			modules: [api.config().nodePath, 'node_modules']
		},
		devtool: api.config().enableSourceMaps ? 'source-map' : false, //'hidden-source-map',
		plugins: [
			api.config().devMode ? new webpack.NamedModulesPlugin() : new webpack.HashedModuleIdsPlugin(),
			// new LiveReloadPlugin({
			// 	port: api.config.get('livereload.port'),
			// 	hostname: publicPath.getLocalIP()
			// })
			new webpack.WatchIgnorePlugin([api.config.resolve('destDir', 'webpack-temp')])
		],
		watchOptions: {
			aggregateTimeout: 700,
			poll: false
		}
	};
}

exports.tapable = tapable;

exports.compile = (api) => {
	var webpackConfig = createWebpackConfig();
	// if (api.argv['webpack-watch'])
	// 	webpackConfig.watch = true;
	mkdirp.sync(api.config.resolve('destDir', 'webpack-temp'));
	// Allow other LEGO component extends this webpack configure object

	return initWebpackConfig(webpackConfig)
	.then(webpackConfig => {
		if (_.size(webpackConfig.entry) === 0)
			return;
		return new Promise((resolve, reject) => {
			webpack(webpackConfig, (err, stats) => {
				if (err) {
					log.error(err.stack || err);
					if (err.details) {
						_.each([].concat(err.details), err => log.error('webpack failure detail', err));
					}
					return reject(err);
				}
				const info = stats.toJson();

				if (stats.hasErrors()) {
					_.each([].concat(info.errors), err => log.error('webpack error', err));
				}

				if (stats.hasWarnings()) {
					_.each([].concat(info.warnings), err => log.warn('webpack warning', err));
				}
				log.info(stats.toString({
					chunks: false,  // Makes the build much quieter
					colors: true    // Shows colors in the console
				}));
				resolve(stats);
			});
		});
	});
};

exports.activate = function() {
	if (!api.argv.webpackWatch)
		return;
	var webpackMiddleware = require('webpack-dev-middleware');
	mkdirp.sync(api.config.resolve('destDir', 'webpack-temp'));
	return api.runBuilder({browserify: false}, api.packageName)
	.then(() => initWebpackConfig(createWebpackConfig()))
	.then(webpackConfig => {
		if (_.size(webpackConfig.entry) === 0)
			return;
		api.use(webpackMiddleware(webpack(webpackConfig), {
			publicPath: '/',
			stats: {
				colors: true
			},
			noInfo: true,
			//noInfo: true,
			watchOptions: {
				aggregateTimeout: 700,
				poll: false
			}
		}));
	});
};

function initWebpackConfig(webpackConfig) {
	if (!api.config().devMode)
		webpackConfig.plugins.push(new UglifyJSPlugin({sourceMap: api.config().enableSourceMaps}));
	// advanced setting
	return Promise.coroutine(function*() {
		yield moreWebpackOptions.setupAsync(webpackConfig);
		return yield Promise.promisify(tapable.applyPluginsAsyncWaterfall.bind(tapable))('webpackConfig', webpackConfig);
	})();
}


