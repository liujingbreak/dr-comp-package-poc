// var gulp = require('gulp');
// var webpackStream = require('webpack-stream');
const webpack = require('webpack');
const api = require('__api');
const mkdirp = require('mkdirp');
const Tapable = require('tapable');
const _ = require('lodash');
const log = require('log4js').getLogger(api.packageName);
const Promise = require('bluebird');
const moreWebpackOptions = require('./lib/moreWebpackOptions.js');
const createWebpackConfig = require('./webpack.config.js');
//const LiveReloadPlugin = require('webpack-livereload-plugin');

const tapable = new Tapable();

exports.tapable = tapable;

exports.compile = () => {
	mkdirp.sync(api.config.resolve('destDir', 'webpack-temp'));

	return initWebpackConfig()
	.then(webpackConfig => {
		if (_.size(webpackConfig.entry) === 0)
			return null;
		return Promise.promisify(webpack)(webpackConfig)
		.then(onSuccess)
		.catch(onFail);
	});
};

exports.activate = function() {
	if (!api.argv.webpackWatch)
		return;
	var webpackMiddleware = require('webpack-dev-middleware');
	mkdirp.sync(api.config.resolve('destDir', 'webpack-temp'));

	return Promise.coroutine(function*() {
		yield api.runBuilder({browserify: false}, api.packageName);
		var webpackConfig = yield initWebpackConfig();
		if (_.size(webpackConfig.entry) === 0)
			return;
		var compiler = webpack(webpackConfig);
		api.use(webpackMiddleware(compiler, {
			quiet: false,
			stats: {
				colors: true
			},
		}));
	})()
	.catch(onFail);
};

function initWebpackConfig() {
	return Promise.coroutine(function*() {
		var pluginParams = yield moreWebpackOptions.createParamsAsync(api.config().rootPath);
		var webpackConfig = createWebpackConfig(...pluginParams);
		// Allow other LEGO component extends this webpack configure object
		return yield Promise.promisify(tapable.applyPluginsAsyncWaterfall.bind(tapable))('webpackConfig', webpackConfig);
	})();
}

function onSuccess(stats) {
	const info = stats.toJson();

	if (stats.hasErrors()) {
		_.each([].concat(info.errors), err => log.error('webpack error', err));
	}

	if (stats.hasWarnings()) {
		_.each([].concat(info.warnings), err => log.warn('webpack warning', err));
	}
	log.info(_.repeat('=', 30));
	log.info(stats.toString({
		chunks: false,  // Makes the build much quieter
		colors: true    // Shows colors in the console
	}));
	return stats;
}

function onFail(err) {
	log.error(err.stack || err);
	if (err.details) {
		_.each([].concat(err.details), err => log.error('webpack failure detail', err));
	}
}

