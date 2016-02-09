
module.exports.activate = function(api) {
	api.constructor.prototype.getCompiledViewPath = function(rawViewPath) {
		return '/' + this.config().destDir + '/server/' + this.packageName + '/' + rawViewPath;
	};
};
