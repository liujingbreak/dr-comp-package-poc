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
};
