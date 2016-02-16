var through = require('through');
var path = require('path');

module.exports = function(file, options) {

	var transform = function(buffer) {
		var self = this;
		var content = buffer.toString('utf8');

		content = content.replace(/!resolve\((.*?)\)/g, function(match, path) {
			try {
				return resolve.sync(path);
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

		this.push(new Buffer(content, 'utf8'));
	};

	var flush = function() {
		this.push(null);
	};

	return through(transform, flush);

};
