module.exports = function(injector) {
	/**
	 *  IoC configuration here.
	 *  Inject(or replacement) specific component package to some value
	 *  you want by:
	 *
	 *  injector.fromPackage('component-package')
	 *  	.substitue('depenency-package', 'another-package')
	 *  	.value('depenency-package', anyValue)
	 *  	.factory('depenency-package', function() { return anyValue; });
	 *
	 *  // Inject to all component packages:
	 *
	 *  injector.fromAllComponents()
	 *  	.substitue('depenency-package', 'another-package');
	 */
	var resolve = require('resolve');
	var nodeSearchPath = require('./lib/nodeSearchPath.js');

	injector.fromPackage(['parcelify', 'less-plugin-npm-import'])
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
};
