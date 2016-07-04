var EventEmitter = require('events');
var config = require('./config');
var packageUitls = require('./packageMgr/packageUtils');
var _ = require('lodash');

module.exports = NodeApi;

function NodeApi(name, packageInstance) {
	this.packageName = name;
	this.packageShortName = packageUitls.parseName(name).name;
	this.packageInstance = packageInstance;
	this.contextPath = this._contextPath();
}

NodeApi.prototype = {
	isBrowser: function() {
		return false;
	},

	isNode: function() {
		return true;
	},

	assetsUrl: function(packageName, path) {
		if (arguments.length === 1) {
			path = packageName;
			packageName = this.packageShortName;
		} else {
			packageName = packageUitls.parseName(packageName).name;
		}
		if (_.startsWith(path, '/')) {
			path = path.substring(1);
		}
		var staticAssetsURL = this.config().staticAssetsURL;
		if (_.endsWith(staticAssetsURL, '/')) {
			staticAssetsURL = staticAssetsURL.substring(0, staticAssetsURL.length - 1);
		}
		return staticAssetsURL + '/' + this.packageShortName + '/' + path;
	},

	/**
	 * join contextPath
	 * @return {[type]} [description]
	 */
	joinContextPath: function(path) {
		return (this.contextPath + '/' + path).replace(/\/\//g, '/');
	},

	_contextPath: function() {
		var path = config.get('packageContextPathMapping[' + this.packageShortName + ']');
		path = path != null ? path : '/' + this.packageShortName;
		if (this.config().nodeRoutePath) {
			path = this.config().nodeRoutePath + '/' + path;
		}
		return path.replace(/\/\/+/g, '/');
	},

	eventBus: new EventEmitter(),
	config: config,
	packageUtils: require('./packageMgr/packageUtils')
};
