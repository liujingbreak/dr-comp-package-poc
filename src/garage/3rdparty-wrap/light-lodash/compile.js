var api = require('__api');
var log = require('log4js').getLogger('light-lodash');

/**
 * During compilation, add lodash function modules to `config.vendorBundleMap`, bundle name is
 * same as the `dr.bundle` value in package.json
 */
exports.compile = function() {
	log.debug(api.config().vendorBundleMap);
	var bundleName = require('./package.json').dr.bundle;
	var packageNames = api.config().vendorBundleMap[bundleName];
	if (!packageNames)
		packageNames = [];
	var lodashFuncList = Object.keys(require('./index.js'))
	.map(fnName => 'lodash/' + fnName);
	packageNames.push.apply(packageNames, lodashFuncList);
	api.config.set('vendorBundleMap[' + bundleName + ']', packageNames);
	log.debug(api.config().vendorBundleMap);
};
