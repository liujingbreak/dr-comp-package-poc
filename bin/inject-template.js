module.exports = function(injector) {
	/**
	 *  IoC configuration here.
	 *  You can inject(aka replacement) required value from specific component package to some value
	 *  you want by:
	 *
	 *  injector.fromPackage('component-package')
	 *  	.substitue('depenency-package', 'another-package')
	 *  	.value('depenency-package', anyValue)
	 *  	.factory('depenency-package', function() { return anyValue; });
	 *
	 *  // Inject to all component packages:
	 *
	 *  injector.fromAllPackages()
	 *  	.substitue('depenency-package', 'another-package');
	 *
	 */
};
