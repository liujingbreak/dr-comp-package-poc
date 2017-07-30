var EventEmitter = require('events');
var chalk = require('chalk');
var config = require('./config');
var packageUitls = require('./packageMgr/packageUtils');
const npmimportCssLoader = require('require-injector/css-loader');
var _ = require('lodash');
const log = require('log4js').getLogger('wfh.nodeApi');

module.exports = NodeApi;

function NodeApi(name, packageInstance) {
	this.packageName = name;
	this.packageShortName = packageUitls.parseName(name).name;
	this.packageInstance = packageInstance;
	this.contextPath = this._contextPath();
}

NodeApi.prototype = {
	buildUtils: require('./gulp/buildUtils'),
	packageUtils: require('./packageMgr/packageUtils'),
	compileNodePath: [config().nodePath],
	eventBus: new EventEmitter(),
	config: config,

	isBrowser: function() {
		return false;
	},

	isNode: function() {
		return true;
	},

	/**
	 * @return {string} | {packageName: string, path: string, isTilde: boolean}, returns string if it is a relative path, or object if
	 * it is in format of /^(?:assets:\/\/|~)((?:@[^\/]+\/)?[^\/]+)?\/(.*)$/
	 */
	normalizeAssetsUrl: function(url, sourceFile) {
		var match = /^(?:assets:\/\/|~)((?:@[^\/]+\/)?[^\/]+)?\/(.*)$/.exec(url);
		if (match) {
			var packageName = match[1];
			var relPath = match[2];
			if (!packageName || packageName === '') {
				var compPackage = this.findPackageByFile(sourceFile);
				packageName = compPackage.longName;
			}
			var injectedPackageName = npmimportCssLoader.getInjectedPackage(packageName, sourceFile, this.browserInjector);
			if (injectedPackageName)
				packageName = injectedPackageName;

			return {
				packageName: packageName,
				path: relPath,
				isTilde: url.charAt(0) === '~'
			};
		} else if (url.length > 1 && url.charAt(0) === '/' && url.charAt(1) !== '/') {
			var msg = `Problematic assets URL format "${chalk.yellow(url)}" used in\n ${chalk.blue(sourceFile)}\n`;
			msg += `Valid path should be a "relative path" or in format as "assets://<package>/<path>" or "~<package>/<path>"`;
			log.warn(msg);
			//throw new Error(msg);
			return url;
		} else {
			return url;
		}
	},

	assetsUrl: function(packageName, path) {
		if (arguments.length === 1) {
			path = packageName;
			packageName = this.packageName;
			var m = /(?:assets:\/\/|~)((?:@[^\/]+\/)?[^\/]+)?\/(.*)/.exec(path);
			if (m) {
				packageName = m[1];
				path = m[2];
			}
		}
		var staticAssetsURL = this.config().staticAssetsURL;
		staticAssetsURL = _.trimEnd(staticAssetsURL, '/');
		// Different locales share same assets resource, we don't copy duplicate resource
		//staticAssetsURL += this.isDefaultLocale() ? '' : '/' + this.getBuildLocale();

		var outputPath = config.get('outputPathMap.' + packageName);
		if (outputPath != null)
			outputPath = _.trim(outputPath, '/');
		else
			outputPath = packageUitls.parseName(packageName).name;
		return staticAssetsURL + ('/' + outputPath + '/' + path).replace(/\/\//g, '/');
	},

	/**
	 * join contextPath
	 * @return {[type]} [description]
	 */
	joinContextPath: function(path) {
		return (this.contextPath + '/' + path).replace(/\/\//g, '/');
	},

	_contextPath: function() {
		var path = config.get('packageContextPathMapping[' + this.packageShortName + ']') ||
			config.get(['packageContextPathMapping', this.packageName]);
		path = path != null ? path : '/' + this.packageShortName;
		if (this.config().nodeRoutePath) {
			path = this.config().nodeRoutePath + '/' + path;
		}
		return path.replace(/\/\/+/g, '/');
	},

	/**
	 * [entryPageUrl description]
	 * @param  {string} packageName      optional, default is current package
	 * @return {string}                  [description]
	 */
	entryPageUrl: function(packageName, relativePagePath) {
		if (relativePagePath.startsWith('npm://')) {
			var m = /^npm:\/\/((?:@[^\/]+\/)?[^\/]+)\/(.+?)$/.exec(relativePagePath);
			relativePagePath = m[2];
		}
		relativePagePath = relativePagePath.replace(/([^.//\\]+\.)[^.\/\\]+$/, '$1html');
		if (!packageName)
			packageName = this.packageName;
		var parsedName = this.parsePackageName(packageName);
		var mappedTo = _.get(this.config(), ['outputPathMap', parsedName.name]) || _.get(this.config(), ['outputPathMap', packageName]);
		if (mappedTo != null)
			mappedTo = _.trim(mappedTo, '/');
		var url = this.config().staticAssetsURL;
		if (!this.config().staticAssetsURL.endsWith('/'))
			url += '/';
		url += this.isDefaultLocale() ? '' : this.getBuildLocale() + '/';
		if (mappedTo != null) {
			if (mappedTo.length > 0)
				url += mappedTo + '/';
		} else {
			url += parsedName.name + '/';
		}
		return url + relativePagePath;
	},

	parsePackageName: function(packageName) {
		return this.packageUtils.parseName(packageName);
	},

	getBuildLocale: function() {
		return this.argv.locale || this.config.get('locales[0]');
	},

	localeBundleFolder: function() {
		return this.config.get('locales[0]') === this.getBuildLocale() ? '' : this.getBuildLocale() + '/';
	},

	isDefaultLocale: function() {
		return this.config.get('locales[0]') === this.getBuildLocale();
	}
};
