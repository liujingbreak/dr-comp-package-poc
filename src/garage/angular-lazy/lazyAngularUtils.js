var lazyAngularUtils;
var eagerAngularModuleFn = angular.module;
var cachedInternals = {};
var lazyModules = {};

lazyAngularUtils = {
	cacheInternals: cacheInternals,
	//captureQ: ['$q', promiseAdaptor.setQ],
	makeLazyAngular: makeLazyAngular,
	initLazyModules: initLazyModules,
	modulesQueue: []
};

module.exports = lazyAngularUtils;

cacheInternals.$inject = ['$provide', '$compileProvider', '$filterProvider', '$controllerProvider', '$animateProvider'];
function cacheInternals($provide, $compileProvider, $filterProvider, $controllerProvider, $animateProvider) {
	cachedInternals.$provide = $provide;
	cachedInternals.$compileProvider = $compileProvider;
	cachedInternals.$filterProvider = $filterProvider;
	cachedInternals.$controllerProvider = $controllerProvider;
	cachedInternals.$animateProvider = $animateProvider;
}

function makeLazyAngular() {
	angular.module = function(name, requires, configFn) {
		var ret;
		if (typeof (requires) === 'undefined') {
			if (lazyModules.hasOwnProperty(name)) ret = lazyModules[name];
			else ret = eagerAngularModuleFn.call(angular, name);
		} else {
			//if( configFn != null ) throw new Error('config function unimplemented yet, module: ' + name);
			ret = makeLazyModule(name, cachedInternals);
			lazyModules[name] = ret;
			ret.realModule = eagerAngularModuleFn.call(angular, name, requires, configFn);
			lazyAngularUtils.modulesQueue.push(ret);
		}
		return ret;
	};
}

function makeLazyModule(name, cachedInternals) {
	var lazyModule = {
		name: name,
		realModule: null,
		__runBlocks: [],
		factory: function() {
			cachedInternals.$provide.factory.apply(cachedInternals.$provide, arguments);
			return lazyModule;
		},
		directive: function() {
			cachedInternals.$compileProvider.directive.apply(cachedInternals.$compileProvider, arguments);
			return lazyModule;
		},
		filter: function() {
			cachedInternals.$filterProvider.register.apply(cachedInternals.$filterProvider, arguments);
			return lazyModule;
		},
		controller: function() {
			cachedInternals.$controllerProvider.register.apply(cachedInternals.$controllerProvider, arguments);
			return lazyModule;
		},
		provider: function() {
			cachedInternals.$provide.provider.apply(cachedInternals.$provide.provider, arguments);
			return lazyModule;
		},
		service: function() {
			cachedInternals.$provide.service.apply(cachedInternals.$provide, arguments);
			return lazyModule;
		},
		run: function(r) {
			this.__runBlocks.push(r);
			return lazyModule;
		},
		value: function() {
			cachedInternals.$provide.value.apply(cachedInternals.$provide, arguments);
			return lazyModule;
		},
		constant: function() {
			cachedInternals.$provide.constant.apply(cachedInternals.$provide, arguments);
			return lazyModule;
		},
		animation: function() {
			cachedInternals.$animateProvider.register.apply(cachedInternals.$animateProvider, arguments);
			return lazyModule;
		},
		component: function() {
			cachedInternals.$compileProvider.component.apply(cachedInternals.$compileProvider, arguments);
			return lazyModule;
		}
		// TODO Only config() is missing from the angular.module interface; decide if we can handle it and how
	};
	return lazyModule;
}

function initLazyModules(injector) {
	var i;
	var modulesQueue = lazyAngularUtils.modulesQueue;
	if (modulesQueue != null && modulesQueue.length > 0) {
		// TODO Run lazy config functions, not implemented yet
		//			for( i=0; i < modulesQueue.length; i++ ) {
		//				callConfigBlocks(injector, modulesQueue[i]);
		//			}
		for (i = 0; i < modulesQueue.length; i++) {
			callRunBlocks(injector, modulesQueue[i]);
		}
		modulesQueue.splice(0);
	}
}

function callRunBlocks(injector, module) {
	var i, blocks;
	blocks = module.__runBlocks || [];
	for (i = 0; i < blocks.length; i++) {
		injector.invoke(blocks[i]);
	}
}
