var through = require('through');
var less = require('less');
var LessPluginAutoPrefix = require('less-plugin-autoprefix');
var NpmImportPlugin = require('less-plugin-npm-import');
var api = require('__api');
var log = require('log4js').getLogger(api.packageName);
var env = require('@dr/environment');

var resolveStaticUrl = require('@dr-core/browserify-builder-api').resolveUrl;

module.exports = function(file, options) {
	log.debug(file);
	var buf = '';
	var currPackage;
	var transform = function(buffer) {
		buf += buffer;
	};


	var flush = function() {
		var self = this;
		var lessOptions = {
			compress: !env.config().devMode,
			paths: [],
			plugins: [
				new LessPluginAutoPrefix({browsers: ['last 3 versions']}),
				new NpmImportPlugin()
			]
		};

		// Injects the path of the current file.
		lessOptions.filename = file;
		less.render(buf, lessOptions)
		.then(function(output) {
			self.push(replaceUrl(output.css));
			self.push(null);
		}, function(err) {
			log.error('parcelifyModuleResolver, error in parsing less ' + err.stack);
			self.emit('error', new Error(getErrorMessage(err), file, err.line));
		});
	};


	function replaceUrl(css) {
		return css.replace(/(\W)url\(['"]?\s*assets:\/\/((?:@[^\/]+\/)?[^\/]+)?(\/.*?)['"]?\s*\)/g,
		function(match, preChar, packageName, path) {
			if (!packageName || packageName === '') {
				if (!currPackage) {
					currPackage = env.findBrowserPackageByPath(file);
				}
				packageName = currPackage;
			}
			if (packageName) {
				log.info('resolve assets: ' + match.substring(1));
			}
			try {
				var resolvedTo = preChar + 'url(' + resolveStaticUrl(env.config, packageName, path) + ')';
				log.debug('-> ' + resolvedTo);
				return resolvedTo;
			} catch (e) {
				log.error(e);
				return match;
			}
		});
	}

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
