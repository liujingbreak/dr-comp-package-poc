var _ = require('lodash');
var config = require('../config');
var log = require('log4js').getLogger('packageMgr.packageNodeInstance');

module.exports = PackageBrowserInstance;

function PackageBrowserInstance(attrs) {
	if (!(this instanceof PackageBrowserInstance)) {
		return new PackageBrowserInstance(attrs);
	}
	_.extend(this, attrs);
	var parsedName = this.parsedName;
	if (parsedName) {
		this.shortName = parsedName.name;
		this.scopeName = parsedName.scope;
	}
	if (!_.includes(config().packageScopes, this.scopeName)) {
		log.debug('3rd-party package ' + this.longName);
		this.active = true;
	}
}
