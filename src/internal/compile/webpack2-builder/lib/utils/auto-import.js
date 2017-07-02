/**
 * Usage:
 * In current JS file:
 * 	var info = require('__autoImport?FOOBAR');
 *  Or
 *  import info from '__autoImport?FOOBAR';
 *
 * In node_modules/packageA/package.json
 * {
 * 	...
 *  "dr": {
 *    "autoImportAs": "FOOBAR",
 *    "autoImportAsync": true
 * }
 * }
 */
var api = require('__api');
var _ = require('lodash');
var log = require('log4js').getLogger('wfh.lib/utils/auto-import');

module.exports = function(sourceFilePath, regexpExecResult) {
	if (!regexpExecResult || !regexpExecResult[1]) {
		return 'new Error("Wrong format of using auto-import")';
	}
	var code = '[\n';
	var idx = 0;
	api.packageInfo.allModules.forEach(m => {
		if (m.dr && m.dr.autoImportAs === regexpExecResult[1]) {
			if (idx !== 0)
				code += ',\n';
			var drProperties = Object.assign({}, m.dr);
			_.each(drProperties, (v, k) => {
				if (k === 'config' || k.startsWith('config.')) {
					delete drProperties[k];
				}
			});
			code += `{name: '${m.longName}', shortName: '${m.shortName}', dr: ${JSON.stringify(drProperties)},`;
			if (m.dr.autoImportAsync !== true)
				code += `  load: function() { return Promise.resolve(require('${m.longName}')); }}`;
			else
				code += `  load: function() {
	return new Promise( resolve => {
		require.ensure([], function(require) {
			resolve(require('${m.longName}'));
		});
	});
}}`;
			idx++;
		}
	});
	code += ']';
	log.info(code);
	return code;
};
