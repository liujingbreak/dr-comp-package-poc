
module.exports.activate = function(api) {
	api.constructor.prototype.getCompiledViewPath = function(packageRelativePath) {
		return '/' + this.config().destDir + '/server/' + this.packageShortName + '/' + packageRelativePath;
	};
};
