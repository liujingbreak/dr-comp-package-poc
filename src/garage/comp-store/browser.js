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
		controller: ['$scope', '$rootScope', '$element', 'compService', 'drLoadingService', 'ScrollableAnim', '$state', '$cacheFactory',
			function($scope, $rootScope, $element, compService, drLoadingService, ScrollableAnim, $state, $cacheFactory) {
				var compStoreVm = this;
				compStoreVm.showNavi = true;
				var scrollPanel;
				var swiper, sc, off$viewContentLoaded;
				var cacheEngine = $cacheFactory('compStore_pagination');

				this.$onInit = function() {
					compStoreVm.quickSearch = drTranslate('搜索组件和小应用');
					//当前页
					cacheEngine.put('page', 0);
					//一页显示数
					cacheEngine.put('pageSize', 25);
					//当前分页的目标，列表-list；搜索-search
					cacheEngine.put('target', 'list');
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
					if (text !== old) {
						cacheEngine.put('page', 0);
						cacheEngine.put('totalPage', 0);
						compStoreVm.packages = null;
						cacheEngine.put('target', 'search');
						if (!text) {
							cacheEngine.put('target', 'list');
						}
					}
					getData(text);
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

				//获取数据
				function getData(text) {
					compStoreVm.error = null;
					var page = cacheEngine.get('page');
					var pageSize = cacheEngine.get('pageSize');
					var totalPage = cacheEngine.get('totalPage');
					//判断请求页是否大于总页数
					if (totalPage && page >= totalPage) {
						drLoadingService.setLoading('compStore', false);
						return false;
					}
					if (page === 0) {
						drLoadingService.setLoading('compStore', true);
					}
					//执行函数标识
					var func = '';
					var index = ++searchCount;
					if (cacheEngine.get('target') === 'list') {
						func = 'getPackagesAndBanner';
					} else if (cacheEngine.get('target') === 'search') {
						func = 'searchPackage';
					}
					return compService[func](page, pageSize, text)
						.then(function(data) {
							if (index === searchCount) {
								//记录搜索总页数
								cacheEngine.put('totalPage', data.totalPage);
								//页数增1
								cacheEngine.put('page', data.page + 1);
								if (!compStoreVm.packages) {
									compStoreVm.packages = [];
								}
								_.forEach(data.packages, function(value) {
									compStoreVm.packages.push(value);
								});
								if (data.page >= data.totalPage) {
									return false;
								} else {
									return true;
								}
							}
						})
						.catch(function(err) {
							compStoreVm.error = err;
						})
						.finally(function(data) {
							drLoadingService.setLoading('compStore', false);
						});
				}

				//下拉滚动时调用
				compStoreVm.loadPage = function(pageIndex) {
					return getData(compStoreVm.nameSearch);
				};
			}
		],
		controllerAs: 'compStoreVm'
	});
	require('./js/comp-services');
	require('./js/comp-group');
	require('./js/comp-card');
	require('./js/comp-detail');
};
