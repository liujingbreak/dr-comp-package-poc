var through = require('through');
var less = require('less');
var NpmImportPlugin = require('less-plugin-npm-import');
var log = require('@dr/logger').getLogger('parcelifyModuleResolver');
var env = require('@dr/environment');

module.exports = function(file, options) {
	var buf = '';
	var transform = function(buffer) {
		buf += buffer;
	};

	var flush = function() {
		var self = this;
		var fileConfig = {
			compress: !env.config().devMode,
			paths: [],
			plugins: [new NpmImportPlugin()]
		};

		// Injects the path of the current file.
		fileConfig.filename = file;

		less.render(buf, fileConfig)
		.then(function(output) {
			self.push(replaceUrl(output.css));
			self.push(null);
		}, function(err) {
			log.error('parcelifyModuleResolver, error in parsing less ' + err.stack);
			self.emit('error', new Error(getErrorMessage(err), file, err.line));
		});
	};


	function replaceUrl(css) {
		return css.replace(/(\W)url\(['"]?assets:\/\/((?:@[^\/]+\/)?[^\/]+)(\/.*?)['"]?\)/g,
		function(match, preChar, packageName, path) {
			if (packageName) {
				log.info('resolve assets: ' + match.substring(1));
			}
			return preChar + 'url(' + env.config().staticAssetsURL + '/assets/' +
			env.packageUtils.parseName(packageName).name + path + ')';
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
