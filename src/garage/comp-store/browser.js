require('@dr/angularjs');
var api = require('__api');
var _ = require('lodash');
var Swiper = require('swiper/dist/js/swiper.jquery.js');

var initialized = false;
var lastSelectedCard;

exports.init = function(app) {
	// Set app as a property of API instance, so that all the files from this package can access it
	// There is only one API instance for each package, it can share stuff cross files within same package.
	api.app = app;
	if (initialized)
		return;
	initialized = true;

	app.component('compStore', {
		template: require('./views/componentStore.html'),
		controller: ['$scope', '$rootScope', '$element', 'compService', 'drLoadingService', 'ScrollableAnim', '$state',
		function($scope, $rootScope, $element, compService, drLoadingService, ScrollableAnim, $state) {
			var compStoreVm = this;
			compStoreVm.showNavi = true;
			var scrollPanel;
			var swiper, sc, off$viewContentLoaded;

			this.$onInit = function() {
				compStoreVm.quickSearch = drTranslate('搜索组件和小应用');
				listPackages();

				$scope.$watch('compStoreVm.nameSearch', search);

				off$viewContentLoaded = $rootScope.$on('$viewContentLoaded', function(event, config) {
					if ($state.is('components') && lastSelectedCard)
						setTimeout(function() {
							var scrollTarget = document.getElementById('comp-' + lastSelectedCard);
							if (scrollTarget && scrollPanel.length > 0) {
								var scrollTop = angular.element(scrollTarget).offset().top - scrollPanel.offset().top;
								scrollPanel.prop('scrollTop', scrollTop);
							}
							initSwiper();
							initScrollableAnim();
						}, 17);
					else {
						if (scrollPanel)
							scrollPanel.prop('scrollTop', 0);
					}

					if (!$state.is('components'))
						destorySwiperAndAnim();
				});
			};
			this.$postLink = function() {
				initSwiper();
				initScrollableAnim();

				scrollPanel = $element.closest('[comp-store-scroll-pane]');
			};

			this.encode = encodeURIComponent;

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

			this.trackSelectedCard = function(name) {
				lastSelectedCard = name;
			};

			this.$onDestroy = function() {
				off$viewContentLoaded();
				destorySwiperAndAnim();
			};

			function initSwiper() {
				//http://idangero.us/swiper/api/#.WHpddmR96qA
				swiper = new Swiper('.swiper-container', {
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
			}

			function initScrollableAnim() {
				var banner = $element.find('.banner');
				sc = ScrollableAnim(angular.element('body').find('.ui-view-main'), 0);
				sc.scene({
					begin: 0,
					duration: banner.prop('offsetHeight'),
					delayPercent: 0,
					// tearDown: function(reverse, offset) {
					// 	if (!reverse) {
					// 		sw.stopAutoplay();
					// 	} else
					// 		sw.startAutoplay();
					// },
					onScroll: function(progress, time) {
						var y = progress * 0.67;
						banner.css('transform', 'translate3d(0, ' + y + 'px, 0)');
						banner.css('-webkit-transform', 'translate3d(0, ' + y + 'px, 0)');
						banner.css('-ms-transform', 'translate3d(0, ' + y + 'px, 0)');
					}
				});
			}

			function destorySwiperAndAnim() {
				if (swiper) {
					swiper.destroy(true, false);
					swiper = null;
				}
				if (sc) {
					sc.destory();
					sc = null;
				}
			}

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
		}],
		controllerAs: 'compStoreVm'
	});
	require('./js/comp-services');
	require('./js/comp-group');
	require('./js/comp-card');
	require('./js/comp-detail');
};
