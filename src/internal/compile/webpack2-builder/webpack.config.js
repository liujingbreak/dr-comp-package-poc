const api = require('__api');
const webpack = require('webpack');
const _ = require('lodash');
const chalk = require('chalk');
const Path = require('path');
const log = require('log4js').getLogger(api.packageName);
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const ManualChunkPlugin = require('./lib/manual-chunk-plugin');
const MultiEntryHtmlPlugin = require('./lib/multi-entry-html-plugin');
const DrModuleResolvePlugin = require('./lib/dr-module-resolve-plugin');

module.exports = function(webpackConfigEntry, noParse, file2ChunkName, entryChunkHtmlAndView,
	legoConfig, chunk4package, sendlivereload, entryHtmlOutputPathPlugin, entryHtmlCssScopePlugin) {
	log.info('nodePath: %s', api.config().nodePath);

	var astCache = {};
	var componentScopes = api.config().packageScopes || [];

	var webpackConfig = {
		context: api.config().rootPath,
		entry: webpackConfigEntry,
		output: {
			filename: api.config().devMode ? '[name].js' : '[name].[chunkhash:10].js',
			chunkFilename: api.config().devMode ? '[id].[name].js' : '[id].[name].[chunkhash:10].js',
			// https://webpack.js.org/loaders/style-loader/
			// We must provide complete protocal:hostname:port, because of blob URL issue of style-loader
			//
			// Note about source maps support and assets referenced with url: when style loader is used
			// with ?sourceMap option, the CSS modules will be generated as Blobs, so relative paths
			// don't work (they would be relative to chrome:blob or chrome:devtools).
			// In order for assets to maintain correct paths setting output.publicPath property of
			// webpack configuration must be set, so that absolute paths are generated.
			publicPath: api.config().publicPath + (api.isDefaultLocale() ? '' : api.getBuildLocale() + '/'),
			path: api.config.resolve('staticDir') + (api.isDefaultLocale() ? '' : '/' + api.getBuildLocale()),
			pathinfo: api.config().devMode
		},
		watch: false,
		module: {
			noParse: noParse,
			rules: [
				// {
				// 	test: function() {
				// 		console.log(arguments);
				// 		return false;
				// 	},
				// 	use: [{loader: 'lib/debug-loader'}]
				// },
				{
					// test if it is our component
					test: testDrComponentFile(['.js', '.jsx', '.ts', '.tsx'], componentScopes),
					use: [
						{loader: '@dr/translate-generator'},
						{loader: 'lib/api-loader', options: {injector: api.browserInjector, astFromCache: astCache}}
					]
				},
				{
					test: /\.js$/,
					use: [
						//{loader: 'lib/debug-loader', options: {id: 'debug-load-js'}},
						{loader: 'require-injector', options: {injector: api.browserInjector, astCache: astCache}}
					],
					parser: {
						amd: false // Do not parse some 3rd-party library as AMD module, like GSAP will fail in AMD module mode
					}
				},
				{
					test: testPackageDrProperty(['.js', '.jsx', '.ts', '.tsx'], 'jsLoader', 'babel'),
					use: [{
						loader: 'babel-loader',
						options: {
							cacheDirectory: api.config.resolve('destDir', 'babel-cache' + (api.isDefaultLocale() ? '' : '/' + api.getBuildLocale())),
							presets: [
								['es2015', {modules: false}],
								'react',
								'stage-0'
							],
							plugins: [
								'transform-decorators-legacy',
								'transform-object-assign',
								'syntax-dynamic-import'
							],
							// Workaround enhanced-resolve, put an nonexisting file here
							babelrc: Path.resolve(api.config().rootPath, '.babelrc')
						}
					}]
				},
				{
					test: /\.jade$/,
					use: [
						{loader: 'html-loader', options: {attrs: 'img:src'}},
						{loader: 'lib/html-loader'}, // Replace keyward assets:// in *[src|href|srcset|ng-src]
						{loader: '@dr/translate-generator'},
						{loader: 'lib/jade-to-html-loader'}
					]
				},
				{
					test: /\.html$/,
					use: [
						{loader: 'html-loader', options: {attrs: 'img:src'}},
						//{loader: 'html-minify-loader'},
						{loader: 'lib/html-loader'}, // Replace keyward assets:// in *[src|href|srcset|ng-src]
						{loader: '@dr/translate-generator'},
						{loader: '@dr/template-builder'}
					]
				},
				{
					test: /\.md$/,
					use: [
						{loader: 'html-loader', options: {attrs: 'img:src'}},
						{loader: 'lib/html-loader'}, // Replace keyward assets:// in *[src|href|srcset|ng-src]
						{loader: 'lib/markdown-loader'}//,
						//{loader: 'lib/debug-loader', options: {id: 0}}
					]
				},
				{
					test: /\.css$/,
					use: ExtractTextPlugin.extract({
						fallback: 'style-loader',
						use: [
							{loader: 'css-loader', options: {
								minimize: !api.config().devMode,
								sourceMap: api.config().enableSourceMaps,
								//importLoaders: 4,
								//modules: true
							}},
							{loader: 'lib/css-scope-loader'},
							{
								loader: 'autoprefixer-loader',
								options: cssAutoPrefixSetting
							},
							{loader: 'lib/css-url-assets-loader'},
							{loader: 'require-injector/css-loader', options: {
								injector: api.browserInjector
							}}
						]
					})
				}, {
					test: /\.less$/,
					use: ExtractTextPlugin.extract({
						fallback: 'style-loader',
						use: [
							{loader: 'css-loader', options: {
								minimize: !api.config().devMode,
								sourceMap: api.config().enableSourceMaps
							}},
							{
								loader: 'autoprefixer-loader',
								options: cssAutoPrefixSetting
							},
							{loader: 'lib/css-scope-loader'},
							{loader: 'lib/css-url-assets-loader'},
							// less-loader sucks, too buggy to use
							// {loader: '@dr/less-loader', options: {sourceMap: false}},
							{loader: 'less-loader', options: {
								sourceMap: false,
								//plugins: [new NpmImportPlugin()]
							}},
							{loader: 'require-injector/css-loader', options: {
								injector: api.browserInjector
							}}
						]
					})
				},
				{
					test: /\.scss$/,
					use: ExtractTextPlugin.extract({
						fallback: 'style-loader',
						use: [
							{loader: 'css-loader', options: {
								minimize: !api.config().devMode,
								sourceMap: api.config().enableSourceMaps
							}},
							{
								loader: 'autoprefixer-loader',
								options: cssAutoPrefixSetting
							},
							{loader: 'lib/css-scope-loader'},
							{loader: 'lib/css-url-assets-loader'},
							// less-loader sucks, too buggy to use
							// {loader: '@dr/less-loader', options: {sourceMap: false}},
							{loader: 'sass-loader', options: {
								sourceMap: false,
								//plugins: [new NpmImportPlugin()]
							}},
							{loader: 'require-injector/css-loader', options: {
								injector: api.browserInjector
							}}
						]
					})
				},
				{
					test: /\.txt$/,
					use: {loader: 'raw-loader'}
				}, {
					test: /\.(yaml|yml)$/,
					use: [
						{loader: 'json-loader'},
						{loader: 'yaml-loader'}
					]
				}, {
					test: /\.(eot|woff2|woff|ttf)$/,
					use: [{loader: 'lib/dr-file-loader'}]
				}, {
					test: /\.(jpg|png|gif|svg|jpeg)$/,
					use: [
						{
							loader: 'url-loader',
							options: {
								limit: !api.config().devMode ? 10000 : 1, // <10k ,use base64 format, dev mode only use url for speed
							}
						}
						// {
						// 	loader: 'image-webpack-loader',
						// 	query: {
						// 		bypassOnDebug: true,
						// 		progressive: true,
						// 		pngquant: {
						// 			quality: '65-90',
						// 			speed: 4
						// 		}
						// 	}
						// }
					]
				}
			]
		},
		resolve: {
			modules: [api.config().nodePath, 'node_modules'],
			plugins: [new DrModuleResolvePlugin()]
		},
		resolveLoader: {
			modules: [__dirname, api.config().nodePath, 'node_modules']
		},
		devtool: api.config().enableSourceMaps ? 'source-map' : false, //'hidden-source-map',
		plugins: [
			//new webpack.optimize.ModuleConcatenationPlugin(),
			api.config().devMode ? new webpack.NamedModulesPlugin() : new webpack.HashedModuleIdsPlugin(),

			new webpack.WatchIgnorePlugin([api.config.resolve('destDir', 'webpack-temp')]),

			new ManualChunkPlugin({
				manifest: 'runtime',
				defaultChunkName: 'extra-chunk',
				getChunkName: (file) => {
					var bundle = file2ChunkName[file];
					if (bundle) {
						log.debug('chunk %s, for file %s', bundle, file);
						return bundle;
					}
					var pk = api.findPackageByFile(file);
					if (!pk) {
						log.warn('No chunk(bundle) name for: %s', chalk.yellow(Path.relative(webpackConfig.context, file)));
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
			}),

			entryHtmlOutputPathPlugin,
			entryHtmlCssScopePlugin,

			new webpack.DefinePlugin({
				LEGO_CONFIG: JSON.stringify(legoConfig),
				'LEGO_CONFIG.buildLocale': JSON.stringify(legoConfig.buildLocale),
				'process.env.NODE_ENV': legoConfig.devMode ? '"development"' : '"production"'
			}),

			function() {
				if (api.config.get('devMode') === true && api.config.get('livereload.enabled', true)) {
					this.plugin('done', function() {
						log.info('live reload page'); // tiny-lr server is started by @dr-core/browserify-builder
						sendlivereload();
					});
				}
			}
			// More dynamically added plugins at end of this function: gzipSizePlugin and UglifyJSPlugin
		],
		stats: {
			entrypoints: true
		},
		watchOptions: {
			aggregateTimeout: 700,
			poll: false
		}
	};
	if (!api.config().devMode) {
		webpackConfig.plugins.push(require('./lib/gzipSizePlugin'));
		// https://webpack.js.org/plugins/uglifyjs-webpack-plugin
		webpackConfig.plugins.push(new webpack.optimize.UglifyJsPlugin({
			sourceMap: api.config().enableSourceMaps,
			mangle: {
				except: ['exports', 'require'] // Hack, don't know why it fixes a weird issue under production
			},
			compress: {
				drop_debugger: true,
				drop_console: true,
				warnings: false
			}
		}));
	}

	function testDrComponentFile(fileSuffix, componentScopes) {
		return function(file) {
			if (!_.some([].concat(fileSuffix), suffix => file.endsWith(suffix)))
				return false;
			if (_.has(file2ChunkName, file))
				return true;
			var component = api.findPackageByFile(file);
			var isOurs = !!(component && (_.includes(componentScopes, component.parsedName.scope) ||
				component.dr));
			// if (!isOurs)
			// 	log.debug('Not ours, skip our loaders for %s', file);
			return isOurs;
		};
	}

	return webpackConfig;
};

function testPackageDrProperty(fileSuffix, propertyKey, propertyValue) {
	return function(file) {
		if (!_.some([].concat(fileSuffix), suffix => file.endsWith(suffix)))
			return;
		var component = api.findPackageByFile(file);
		if (component) {
			if (_.get(component, ['dr', propertyKey]) === propertyValue) {
				return true;
			}
		}
		return false;
	};
}

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

