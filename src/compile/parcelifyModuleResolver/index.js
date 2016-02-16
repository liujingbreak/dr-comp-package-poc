var through = require('through');
var resolve = require('browser-resolve');
var less = require('less');
var Path = require('path');
var fs = require('fs');
var _ = require('lodash');


var lookupPackagejsonFolder = _.memoize(_recursiveLookupPackagejsonFolder);

module.exports = function(file, options) {
	var buf = '';
	var transform = function(buffer) {
		buf += buffer;
	};

	var flush = function() {
		var self = this;

		buf = buf.replace(/!package\((.*?)\)/g, function(match, path) {
			try {
				var resolved = lookupPackagejsonFolder(resolve.sync(path, {
					browser: 'style'
				}));
				return resolved;
			} catch (e) {
				console.log(e);
				return self.emit(
					'error',
					new Error(
						'Could not resolve "' + path + '" in file "' + file + '": '
					)
				);
			}
		});

		var fileConfig = {
			compress: true,
			paths: []
		};

		// Injects the path of the current file.
		fileConfig.filename = file;

		less.render(buf, fileConfig, function(err, output) {
			if (err) {
				self.emit('error', new Error(getErrorMessage(err), file, err.line));
			} else {
				self.push(output.css);
			}
			self.push(null);
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

		return msg;
	}
	return through(transform, flush);
};

function _recursiveLookupPackagejsonFolder(targetPath) {
	var path = targetPath;
	var folder = Path.dirname(path);
	while (!fs.existsSync(Path.join(folder, 'package.json'))) {
		var parentFolder = Path.dirname(folder);
		if (folder === parentFolder) {
			// root directory is reached
			throw new Error('package.json is not found for ' + targetPath);
		}
		folder = parentFolder;
	}
	return folder;
}
