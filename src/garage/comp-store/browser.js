require('@dr/angularjs');
var api = require('__api');
var _ = require('lodash');
var Swiper = require('swiper/dist/js/swiper.jquery.js');

var initialized = false;
exports.init = function(app) {
	// Set app as a property of API instance, so that all the files from this package can access it
	// There is only one API instance for each package, it can share stuff cross files within same package.
	api.app = app;
	if (initialized)
		return;
	initialized = true;

	app.component('compStore', {
		template: require('./views/componentStore.html'),
		controller: ['$scope', '$element', 'compService', 'drLoadingService', 'ScrollableAnim',
		function($scope, $element, compService, drLoadingService, ScrollableAnim) {
			var compStoreVm = this;
			compStoreVm.showNavi = true;

			this.$onInit = function() {
				compStoreVm.quickSearch = drTranslate('搜索组件和小应用');
				listPackages();

				$scope.$watch('compStoreVm.nameSearch', search);
			};
			this.$postLink = function() {
				var sw = new Swiper('.swiper-container', {
					// Optional parameters
					//direction: 'vertical',
					autoplay: 2500,
					speed: 800,
					effect: 'flip',
					flip: {
						slideShadows: true,
						limitRotation: true
					},
					cube: {
						slideShadows: true,
						shadow: true,
						shadowOffset: 20,
						shadowScale: 0.94
					},
					loop: true,
					parallax: true
				});

				var sc = ScrollableAnim($element.find('.comp-main'));
				sc.scene({
					triggerElement: $element.find('comp-group').eq(0),
					delayPercent: 50,
					startup: function(reverse, offset) {
						if (!reverse) {
							sw.stopAutoplay();
						} else
							sw.startAutoplay();
					}
				});
			};

			var searchCount = 0;
			var search = _.debounce(function(text, old) {
				if (text) {
					compStoreVm.error = null;
					var index = ++searchCount;
					drLoadingService.setLoading('compStore', true);
					compService.searchPackage(text)
					.then(function(data) {
						if (index === searchCount)
							compStoreVm.packages = data.packages;
					})
					.catch(function(err) {
						compStoreVm.error = err;
					})
					.finally(function() {
						drLoadingService.setLoading('compStore', false);
					});
				} else if (text !== old){
					listPackages();
				}
			}, 800);

			function listPackages() {
				drLoadingService.setLoading('compStore', true);
				compStoreVm.error = null;
				compService.getPackagesAndBanner()
				.then(function(data) {
					compStoreVm.banner = data.banner;
					compStoreVm.packages = data.packages;
				})
				.catch(function(err) {
					compStoreVm.error = err.message;
				})
				.finally(function() {
					drLoadingService.setLoading('compStore', false);
				});
			}
			// this.$onChanges = function(changes) {
			// 	debugger;
			// 	if (changes.nameSearch) {
			// 		console.log('search %s', changes.nameSearch.currentValue);
			// 	}
			// };
		}],
		controllerAs: 'compStoreVm'
	});
	require('./js/comp-services');
	require('./js/comp-group');
	require('./js/comp-card');
	require('./js/comp-detail');
};
