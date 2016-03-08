var Promise = require('bluebird');

module.exports = function(compileProvider) {
	compileProvider.directive('drMenuAside', ['$timeout',
	'$parse',
	'$compile',
	factory]);
};

var OPENED = 1;
var EXPANDED = 2;
var CLOSED = 0;
var SUBMENU_EXP_LEFT = 66 - 240;
/**
 * @attribute onMenuEnter angular expression
 * e.g.
 * <div dr-aside-menu on-menu-enter=" doSomething() " on-menu-leave="">
 */
function factory($timeout, $parse, $compile) {
	return {
		scope: true,
		require: '?^^drDocHome',
		compile: function(tElement, tAttrs, transclude) {
			var liTemplate = tElement.find('.dr-menu').eq(0).find('li');
			liTemplate.attr({
				'ng-repeat': liTemplate.attr('menu-item-instance') + ' in ' + tAttrs.drMenuAside,
				'menu-item-index': '{{$index}}'
			});
			var subMenuLiTemplate = tElement.find('.sub-menu li');
			subMenuLiTemplate.attr({
				'ng-repeat': subMenuLiTemplate.attr('menu-item-instance') + ' in currSubMenus',
				'submenu-item-index': '{{$index}}'
			});

			return function link(scope, iElement, iAttrs, controller) {
				var AnimQ = require('../service/animQueue');
				var animQueue = new AnimQ();
				scope.currSubMenus = [];
				var subMenuState = CLOSED;
				var subMenuEl, subMenuLeft, liList, hoverMenuIdx;
				var getMenuItem = $parse(iAttrs.drMenuAside);
				var getMenuSelectedIdx = $parse(iAttrs.menuSelected);

				iElement.find('.dr-menu').eq(0).delegate('button', 'click', function(evt) {
					var i = parseInt(angular.element(evt.currentTarget).closest('li').attr('menu-item-index'), 10);
					var item = getMenuItem(scope)[i];
					if (item.action) {
						item.action();
					}
					scope.$apply();
				});
				var selectedIdx;
				$timeout(function() {
					var menu = iElement.find('.dr-menu').eq(0);
					subMenuEl = iElement.find('.sub-menu');
					subMenuLeft = subMenuEl.position().left;
					liList = menu.children();
					scope.$watch(iAttrs.menuSelected, function(value) {
						highlightMenu(value);
					});

					menu.delegate('>li', 'mouseenter', function(evt) {
						changeSubMenu(evt, function closePrev() {
							animQueue.then(function(next) {
								return new Promise(function(resolve) {
									TweenMax.to(subMenuEl[0], 0.25, {x: 0, ease: 'Power2.easeOut', onComplete: resolve});
								});
							});
							subMenuState = CLOSED;
						},
						function openNext(hoverIdx) {
							//subMenuEl.off('mouseenter');
							subMenuState = OPENED;
							animQueue.then(function() {
								return new Promise(function(resolve) {
									if (hoverIdx === selectedIdx) {
										subMenuEl.addClass('highlight');
									} else {
										subMenuEl.removeClass('highlight');
									}
									TweenMax.to(subMenuEl[0], 0.25, {x: -33, ease: 'Power2.easeOut', onComplete: resolve});
								});
							});
						}, true);
					});
					subMenuEl.on('mouseenter', subMenuEnter);

					subMenuEl.delegate('button', 'click', selectSubMenuItem);
				}, 0, false);

				if (controller){
					iElement.on('mouseenter', function(event) {
						controller.menuEnter({width: subMenuLeft});
						scope.$apply();
					});
					iElement.on('mouseleave', function(event) {
						controller.menuLeave(scope);
						animQueue.then(function() {
							TweenMax.set(subMenuEl[0], {x: 0});
							return Promise.resolve();
						});
						scope.$apply();
						subMenuState = CLOSED;
					});
				}

				function subMenuEnter(evt) {
					subMenuEl.off('mouseenter');
					subMenuState = EXPANDED;
					animQueue.then(function() {
						subMenuEl.addClass('highlight');
						var defer = Promise.defer();
						TweenMax.to(subMenuEl[0], 0.25, {x: SUBMENU_EXP_LEFT, ease: 'Power2.easeOut', onComplete: defer.resolve});
						highlightMenu(hoverMenuIdx);
						scope.$apply();
						return defer.promise;
					});
					controller.menuExpand({width: subMenuEl.prop('offsetWidth') + 66});
					scope.$apply();
					subMenuEl.on('mouseleave', subMenuLeave);
				}

				function subMenuLeave(evt) {
					subMenuEl.off('mouseleave');
					subMenuState = OPENED;
					animQueue.then(function() {
						var defer = Promise.defer();
						TweenMax.to(subMenuEl[0], 0.25, {x: -33, ease: 'Power2.easeOut', onComplete: defer.resolve});
						var selectedIdx = getMenuSelectedIdx(scope);
						if (lastHover !== selectedIdx) {
							subMenuEl.removeClass('highlight');
						}
						highlightMenu(selectedIdx);
						scope.$apply();
						return defer.promise;
					});
					controller.menuUnexpand({width: subMenuLeft});
					scope.$apply();
					subMenuEl.on('mouseenter', subMenuEnter);
				}

				function highlightMenu(sIndex) {
					if (sIndex == null) {
						return;
					}
					liList.removeClass('dr-checked');
					selectedIdx = parseInt(sIndex, 10);
					var li = liList.eq(selectedIdx);
					li.addClass('dr-checked');
					scope.currSubMenus = getMenuItem(scope)[selectedIdx].subMenu;
					animQueue.then(function(next) {
						subMenuEl.addClass('highlight');
						return Promise.resolve();
					});
				}

				var lastHover;
				function changeSubMenu(evt, closePrev, openNext, isHover) {
					hoverMenuIdx = parseInt(evt.currentTarget.getAttribute('menu-item-index'), 10);
					if (subMenuState !== CLOSED && hoverMenuIdx === lastHover) {
						return;
					}
					var menuItems = getMenuItem(scope);
					var lastItem = menuItems[lastHover];
					var item = menuItems[hoverMenuIdx];
					if (lastItem && lastItem.subMenu && lastItem.subMenu.length > 0) {
						closePrev();
					}
					lastHover = hoverMenuIdx;
					if (item.subMenu && item.subMenu.length > 0) {
						scope.currHoverMenu = getMenuItem(scope)[hoverMenuIdx];
						scope.currSubMenus = scope.currHoverMenu.subMenu;

						scope.$apply();
						$timeout(function() {
							openNext(hoverMenuIdx);
						}, 0, false);
					}
				}

				function selectSubMenuItem(evt) {
					var idx = angular.element(evt.currentTarget).closest('li').attr('submenu-item-index');
					idx = parseInt(idx, 10);
					var item = scope.currSubMenus[idx];
					var lis = subMenuEl.find('li');
					lis.removeClass('checked');
					lis.eq(idx).addClass('checked');
					item.action();
					scope.$apply();
				}
			};
		}
	};
}
