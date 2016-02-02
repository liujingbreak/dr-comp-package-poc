
module.exports.activate = function(api) {
	api._constructor.prototype.getCompiledViewPath = function(rawViewPath) {
		return '/' + this.config().compiledDir + '/' + this.packageName + '/' + rawViewPath;
	};
};
