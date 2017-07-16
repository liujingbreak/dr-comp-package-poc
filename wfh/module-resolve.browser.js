module.exports = function(injector) {
	/**
	 *  IoC configuration here.
	 *  You can inject(aka replacement) required value from specific component package to some value
	 *  you want by:
	 *
	 *  injector.fromPackage('component-package')
	 *  	.substitute('depenency-package', 'another-package')
	 *  	.value('depenency-package', anyValue)
	 *  	.factory('depenency-package', function() { return anyValue; });
	 *
	 *  // Inject to all component packages:
	 *
	 *  injector.fromAllPackage()
	 *  	.substitute('depenency-package', 'another-package');
	 *  // Or
	 *  injector.fromDir(['src', 'node_modules'])
	 *      .substitute('depenency-package', 'another-package');
	 * For example,
	 *
	 * Assume you have a component depends on `@dr/angularjs`, it calls
	 * 	`require('@dr/angularjs')` somewhere in the source code.
	 * But you have a CDN library script link already on entry page, you don't want
	 * this "angularjs" package get packed to bundle file anymore:
	 *
	 * 	injector.fromAllComponents().factory('@dr/angularjs',
	 * 		function() {return window.angular;});
	 */
	// Use light-lodash instead of lodash will only reduce around 7kb of gzipped bundle size
	//injector.notFromPackages('lodash').substitute('lodash', '@dr/lodash3');
	injector.fromPackage('@dr/example-browserify').substitute('__self', '@dr/example-browserify');
	injector.fromPackage('@dr/fabricjs')
		.value('canvas', null)
		.value('jsdom', null);
	injector.fromPackage('angular-highlightjs').substitute('angular', '@dr/angularjs');
};
