
exports.activate = function(api) {
	Object.getPrototypeOf(api).getCompiledViewPath = function(packageRelativePath) {
		return '/' + this.config().destDir + '/server/' + this.packageShortName + '/' + packageRelativePath;
	};
};

exports.compile = function(api) {
	var apiProto = Object.getPrototypeOf(api);
	/**
	 * Add transform to browserify builder's pipe stream
	 * @param {transform} | {transform[]} transforms
	 */
	apiProto.builder = {
		addTransform: function(transforms) {
			require('@dr-core/browserify-builder').addTransform(transforms);
		},

		addEntry: function(path, json) {
			// TODO
		}
	};
};

exports.resolveUrl = require('./resolveUrl');
