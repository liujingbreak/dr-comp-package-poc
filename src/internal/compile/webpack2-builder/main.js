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
		return Promise.promisify(webpack)(webpackConfig);
	})
	.then(stats => {
		onSuccess(stats);
	});
	//.catch(onFail);
};

exports.activate = function() {
	if (!api.argv.webpackWatch && !api.argv.poll)
		return;
	var webpackMiddleware = require('webpack-dev-middleware');
	mkdirp.sync(api.config.resolve('destDir', 'webpack-temp'));

	return Promise.coroutine(function*() {
		yield api.runBuilder({browserify: false}, api.packageName);
		var webpackConfig = yield initWebpackConfig();
		if (_.size(webpackConfig.entry) === 0)
			return;
		var compiler = webpack(webpackConfig);
		api.use((api.isDefaultLocale() ? '/' : '/' + api.getBuildLocale()), webpackMiddleware(compiler, {
			//quiet: true,
			//noInfo: true,
			watchOptions: {
				poll: api.argv.poll ? true : false,
				aggregateTimeout: 300
			},
			stats: {
				colors: true
			},
		}));
	})()
	.catch(onFail);
};

function initWebpackConfig() {
	return Promise.coroutine(function*() {
		api.browserInjector.fromAllPackages()
			.replaceCode(/^__autoImport\?(.*)$/, require('./lib/utils/auto-import.js'));
		var pluginParams = moreWebpackOptions.createParams(api.config().rootPath);
		var webpackConfig = createWebpackConfig(...pluginParams.params);
		// Allow other LEGO component extends this webpack configure object
		var changedConfig = yield Promise.promisify(tapable.applyPluginsAsyncWaterfall.bind(tapable))('webpackConfig', webpackConfig);
		pluginParams.writeEntryFileAync(changedConfig.module.rules);
		return changedConfig;
	})();
}

function onSuccess(stats) {
	if (!stats)
		return null;
	log.info(_.repeat('=', 30));
	log.info(stats.toString({
		chunks: false,  // Makes the build much quieter
		colors: true    // Shows colors in the console
	}));
	if (stats.hasErrors()) {
		throw new Error('Webpack build contains errors');
	}
	return stats;
}

function onFail(err) {
	log.error(err.stack || err);
	if (err.details) {
		_.each([].concat(err.details), err => log.error('webpack failure detail', err));
	}
}

