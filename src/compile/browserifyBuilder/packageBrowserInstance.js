var _ = require('lodash');

module.exports = PackageBrowserInstance;

/**
 * PackageBrowserInstance
 * @param {[type]} configSetting
 * @param {string} attrs.bundle
 * @param {string} attrs.longName
 * @param {string} attrs.file
 * @param {string} attrs.parsedName
 * @param {string} attrs.active
 * @param {string} attrs.entryPage
 */
function PackageBrowserInstance(configSetting, attrs) {
	if (!(this instanceof PackageBrowserInstance)) {
		return new PackageBrowserInstance(configSetting, attrs);
	}
	this.configSetting = configSetting;
	if (attrs) {
		this.init(attrs, configSetting);
	}
}

PackageBrowserInstance.prototype = {
	init: function(attrs) {
		_.assign(this, attrs);
		var parsedName = this.parsedName;
		if (parsedName) {
			this.shortName = parsedName.name;
			this.scopeName = parsedName.scope;
		}
		if (!_.includes(this.configSetting.packageScopes, this.scopeName)) {
			//log.debug('3rd-party package ' + this.longName);
			this.active = true;
		}
	},

	toString: function() {
		return 'Package: ' + this.longName;
	}
};
