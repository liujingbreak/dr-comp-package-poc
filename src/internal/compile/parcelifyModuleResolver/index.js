var through = require('through');
var less = require('less');
var LessPluginAutoPrefix = require('less-plugin-autoprefix');
var NpmImportPlugin = require('less-plugin-npm-import');
var api = require('__api');
var _ = require('lodash');
var log = require('log4js').getLogger(api.packageName);

var resolveStaticUrl = require('@dr-core/browserify-builder-api').resolveUrl;

var packagePathPat = /assets:\/\/((?:@[^\/]+\/)?[^\/]+)?(\/.*)/;
var npmUrlPat = /npm:\/\/((?:@[^\/]+\/)?[^\/]+\/).*/;

module.exports = function(file, options) {
	var buf = '';
	var currPackage;
	var transform = function(buffer) {
		buf += buffer;
	};


	var flush = function() {
		var self = this;
		var lessOptions = {
			compress: !api.config().devMode,
			paths: [],
			// sourceMap: {
			// 	sourceMapFileInline: api.config().enableSourceMaps
			// },
			plugins: [
				new LessPluginAutoPrefix({browsers: ['last 3 versions']}),
				new NpmImportPlugin()
			]
		};
		buf = injectReplace(buf, file);
		// Injects the path of the current file.
		lessOptions.filename = file;
		less.render(buf, lessOptions)
		.then(function(output) {
			self.push(replaceUrl(output.css, currPackage, file));
			self.push(null);
		}, function(err) {
			log.error('parcelifyModuleResolver, error in parsing less ' + err.stack);
			self.emit('error', new Error(getErrorMessage(err), file, err.line));
		});
	};

	function getErrorMessage(err) {
		var msg = err.message;
		if (err.line) {
			msg += ', line ' + err.line;
		}
		if (err.column) {
			msg += ', column ' + err.column;
		}
		if (err.extract) {
			msg += ': "' + err.extract + '"';
		}
		if (err.stack) {
			msg += '\n' + err.stack;
		}
		return msg;
	}
	return through(transform, flush);
};

function replaceUrl(css, currPackage, file) {
	return css.replace(/(\W)url\(\s*['"]?\s*([^'"]*)['"]?\s*\)/g,
	function(match, preChar, url) {
		var assetsUrlMatch = packagePathPat.exec(url);
		if (assetsUrlMatch) {
			var packageName = assetsUrlMatch[1];
			var path = assetsUrlMatch[2];
			if (!packageName || packageName === '') {
				if (!currPackage) {
					currPackage = api.findBrowserPackageByPath(file);
				}
				packageName = currPackage;
			}
			if (packageName) {
				log.info('resolve assets: ' + match.substring(1));
			}
			try {
				var injectedPackageName = getInjectedPackage(packageName, file);
				var resolvedTo = preChar + 'url(' + resolveStaticUrl(api.config, injectedPackageName ? injectedPackageName : packageName, path) + ')';
				log.info('-> ' + resolvedTo);
				return resolvedTo;
			} catch (e) {
				log.error(e);
				return match;
			}
		} else if (!url.startsWith('http://') &&
			!url.startsWith('https://') &&
			!url.startsWith('//') &&
			!url.startsWith('data:')){
			log.error(`Problematic assets URL format:${url} in file ${file}, \nshould start with "assets://<package-name>", "//", "http://", "https://", "data:"`);
			return match;
		} else
			return match;
	});
}

function injectReplace(content, file) {
	content.replace(/@import\s+["']([^'"]+)["']/g, (match, p1, offset, whole) => {
		if (p1.startsWith('npm://')) {
			var newPackage = getInjectedPackage(file, npmUrlPat.exec(p1)[1]);
			if (newPackage) {
				log.info(`Found less import target: ${p1}, replaced to ${newPackage}`);
				return newPackage;
			}
		}
		return p1;
	});
	return content;
}

function getInjectedPackage(file, origPackageName) {
	var factoryMap = api.browserInjector.factoryMapForFile(file);
	if (factoryMap) {
		var ij = factoryMap.getInjector(origPackageName);
		if (ij && _.has(ij, 'substitute')) {
			//log.debug(`Found less import target: ${origPackageName}, replaced to ${ij.substitute}`);
			return ij.substitute;
		}
	}
	return null;
}
