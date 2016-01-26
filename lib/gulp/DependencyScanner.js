var gutil = require('gulp-util');
var PluginError = gutil.PluginError;
var through = require('through2');
var File = require('vinyl');
var fs = require('fs');
var Path = require('path');
var Q = require('q');
var _ = require('lodash');
var resolve = require('browser-resolve');
var findPackagePath = require('../packageMgr/packageUtils');
var config = require('../config');
var packageUtil = require('../packageMgr/packageUtils');

module.exports = {
	dependedBrowserPackage: dependedBrowserPackage
};
/**
 * this function read main package.json, attribute "dependencies", and dives into
 * each module, fetches those depended module's package.json
 */
function dependedBrowserPackage() {
	return through.obj(function(file, encoding, callback) {
		var self = this;
		var pj = JSON.parse(fs.readFileSync(file.path, 'utf-8'));
		if (!pj.dependencies) {
			return callback();
		}
		_.forOwn(pj.dependencies, function(version, name) {
			var parsedName = packageUtil.parseName(name);
			if (!_.includes(config().packageScopes, parsedName.scope)) {
				return;
			}
			var path = resolve.sync(name);

			self.push(new File({
				base: Path.dirname(file),
				path: path
			}));
		});
		callback();
	});
}
