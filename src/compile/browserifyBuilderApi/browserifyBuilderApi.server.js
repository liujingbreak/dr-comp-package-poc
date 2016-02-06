
module.exports.activate = function(api) {
	api.constructor.prototype.getCompiledViewPath = function(rawViewPath) {
		return '/' + this.config().compiledDir + '/' + this.packageName + '/' + rawViewPath;
	};
};
