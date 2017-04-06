require('@dr/angularjs');
var api = require('__api');
var _ = require('lodash');
var Swiper = require('swiper/dist/js/swiper.jquery.js');
var jsonCategory = require('./categories-{locale}.yaml');

var initialized = false;
var lastSelectedCard;

exports.init = function(app) {
	// Set app as a property of API instance, so that all the files from this package can access it
	// There is only one API instance for each package, it can share stuff cross files within same package.
	api.app = app;
	if (initialized)
		return;
	initialized = true;
	var cacheEngine;

	app.component('compStore', {
		template: require('../views/componentStore.html'),
		controller: ['$scope', '$rootScope', '$element', 'compService', 'drLoadingService', 'ScrollableAnim', '$state', '$cacheFactory',
			function($scope, $rootScope, $element, compService, drLoadingService, ScrollableAnim, $state, $cacheFactory) {
				var compStoreVm = this;
				compStoreVm.showNavi = true;
				var scrollPanel;
				var swiper, sc, off$viewContentLoaded;
				if (!cacheEngine)
					cacheEngine = $cacheFactory('compStore_pagination');

				this.$onInit = function() {
					compStoreVm.quickSearch = drTranslate('搜索组件和小应用');
					initData();
					//初始化下拉选项
					compStoreVm.categories = jsonCategory;
					//初始化选项
					compStoreVm.category = $rootScope.component_store_category || jsonCategory[0].value;
					$scope.$watch('compStoreVm.nameSearch', search);
					//监听下拉选项
					$scope.$watch('compStoreVm.category', select);
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
						initData();
						cacheEngine.put('target', 'search');
						if (!text) {
							cacheEngine.put('target', 'list');
						} else
							compStoreVm.category = 'all';
					}
					getData(text);
				}, 800);

				function select(text, old) {
					if (text !== old) {
						initData();
						$rootScope.component_store_category = text;
						if (text === 'all') {
							getData();
						} else {
							getData(null, text);
						}
					}
				}

				this.trackSelectedCard = function(name) {
					lastSelectedCard = name;
				};

				this.$onDestroy = function() {
					off$viewContentLoaded();
					destorySwiperAndAnim();
				};

				function initData() {
					compStoreVm.packages = null;
					cacheEngine.removeAll();
					cacheEngine.put('page', 0);
					//一页显示数
					cacheEngine.put('pageSize', 25);
					//当前分页的目标，列表-list；搜索-search
					cacheEngine.put('target', 'list');
				}

				function initSwiper() {
					//http://idangero.us/swiper/api/#.WHpddmR96qA
					swiper = new Swiper('.swiper-container', {
						// Optional parameters
						//direction: 'vertical',
						autoplay: 4000,
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
					setTimeout(function() {
						// Since this package is split loaded, css is loaded by style-loader lazily,
						// force style-loader's change apply to page before running JS code
						(function doNothing() {})(document.body.offsetWidth + 1); // for reflow
						swiper.update();
					}, 0);
				}

				function initScrollableAnim() {
					var banner = $element.find('.banner');
					sc = ScrollableAnim(angular.element('body').find('.ui-view-main'), 0);
					sc.scene({
						begin: 0,
						duration: banner.prop('offsetHeight'),
						delayPercent: 0,
						timeline: function(timeline) {
							timeline.fromTo(banner[0], 1, {yPercent: 0}, {yPercent: 50, ease: Linear.easeNone});
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
				function getData(searchText, selectText) {
					compStoreVm.error = null;
					var page = cacheEngine.get('page');
					var pageSize = cacheEngine.get('pageSize');
					var totalPage = cacheEngine.get('totalPage');
					var param_1, param_2;
					//判断请求页是否大于总页数
					if (totalPage != null && page >= totalPage) {
						//drLoadingService.setLoading('compStore', false);
						return false;
					}
					// if (page === 0) {
					// 	drLoadingService.setLoading('compStore', true);
					// }
					//执行函数标识
					var func = '';
					var index = ++searchCount;
					if (selectText) {
						func = 'select';
						param_1 = 'dr.category';
						param_2 = selectText;
					} else {
						if (cacheEngine.get('target') === 'list') {
							func = 'getPackagesAndBanner';
						} else if (cacheEngine.get('target') === 'search') {
							func = 'searchPackage';
							param_1 = searchText;
						}
					}
					return compService[func](page, pageSize, param_1, param_2)
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
						});
					// .finally(function(data) {
					// 	drLoadingService.setLoading('compStore', false);
					// });
				}

				//下拉滚动时调用
				compStoreVm.loadPage = function(pageIndex) {
					return getData(compStoreVm.nameSearch);
				};
			}
		],
		controllerAs: 'compStoreVm'
	});
	require('./comp-services');
	require('./comp-group');
	require('./comp-card');
	require('./comp-detail');
};
