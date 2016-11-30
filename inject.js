module.exports = function(injector) {
	/**
	 *  IoC configuration here.
	 *  Inject(or replacement) specific component package to some value
	 *  you want by:
	 *
	 *  injector.fromPackage('component-package')
	 *  	.substitute('depenency-package', 'another-package')
	 *  	.value('depenency-package', anyValue)
	 *  	.factory('depenency-package', function() { return anyValue; });
	 *
	 *  // Inject to all component packages:
	 *
	 *  injector.fromAllComponents()
	 *  	.substitute('depenency-package', 'another-package');
	 */
	var _ = require('lodash');
	var resolve = require('resolve');
	var nodeSearchPath = require('./lib/nodeSearchPath.js');

	injector.fromPackage(['parcelify', 'less-plugin-npm-import', '@dr/parcelify-module-resolver'])
	.factory('resolve', function(sourceFilePath) {
		function _resolve(id, opts, cb) {
			if (opts.paths)
				opts.paths.push.apply(opts.paths, nodeSearchPath.browserifyPaths);
			else {
				opts.paths = nodeSearchPath.browserifyPaths;
			}
			return resolve(id, opts, cb);
		}
		_resolve.sync = function(id, opts) {
			if (opts.paths)
				opts.paths.push.apply(opts.paths, nodeSearchPath.browserifyPaths);
			else {
				opts.paths = nodeSearchPath.browserifyPaths;
			}
			return resolve.sync(id, opts);
		};
		return _resolve;
	});

	var chalk = require('chalk');
	var config = require('./lib/config');
	injector.fromAllComponents()
	.factory('chalk', function() {
		return new chalk.constructor({enabled: config.get('colorfulConsole') !== false && _.toLower(process.env.CHALK_ENABLED) !== 'false'});
	});
};
