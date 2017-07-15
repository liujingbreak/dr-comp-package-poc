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
var Path = require('path');
var log = require('log4js').getLogger('wfh.lib/utils/auto-import');
var fs = require('fs');

var fileChunkMap = {};
module.exports = fileChunkMap;

api.browserInjector.fromAllPackages()
	.replaceCode(/^__autoImport\?(.*)$/, replaceRequire);

function replaceRequire(sourceFilePath, regexpExecResult) {
	if (!regexpExecResult || !regexpExecResult[1]) {
		return 'new Error("Wrong format of using auto-import")';
	}
	var autoImport = regexpExecResult[1];
	var code = '[\n';
	var idx = 0;
	var chunk = _.get(api.findPackageByFile(sourceFilePath), 'bundle');
	api.packageInfo.allModules.forEach(m => {
		var importAs = _.get(m, 'dr.autoImportAs');
		let jsFile;
		if (_.isObject(importAs) && _.has(importAs, autoImport)) {
			jsFile = Path.posix.join(m.longName, importAs[autoImport]);
		} else if (importAs === autoImport) {
			jsFile = m.longName;
		}
		if (jsFile) {
			let resolved = fs.realpathSync(api.packageUtils.browserResolve(jsFile));
			log.debug('autoImport file %s from chunk', resolved, chunk);
			fileChunkMap[resolved] = chunk;

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
				code += `  load: function() { return Promise.resolve(require('${jsFile}')); }}`;
			else
				code += `  load: function() {
	return new Promise(function(resolve) {
		require.ensure([], function(require) {
			resolve(require('${jsFile}'));
		});
	});
}}`;
			idx++;
		}
	});
	code += ']';
	log.debug(code);
	return code;
}
