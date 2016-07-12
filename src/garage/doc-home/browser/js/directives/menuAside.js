var Promise = require('bluebird');
var _ = require('lodash');
var Modernizr = require('@dr/respond-js');

module.exports = function(compileProvider) {
	compileProvider.directive('drMenuAside', ['$timeout',
	'$parse',
	'$compile',
	factory]);
};

var VISIBLE = 1;
var EXPANDED = 2;
var HIDDEN = 0;
var SUBMENU_EXP_LEFT = 66;
var ASIDE_MENU_WIDTH = 240;
var SUBMENU_EXP_OPEN_LEFT = ASIDE_MENU_WIDTH - 33;
/**
 * @attribute onMenuEnter angular expression
 * e.g.
 * <div dr-aside-menu on-menu-enter=" doSomething() " on-menu-leave="">
 */
function factory($timeout, $parse, $compile) {
	return {
		scope: true,
		require: '^^drDocHome',
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
				var mainMenuState = VISIBLE;
				var subMenuState = HIDDEN;
				var subMenuEl, subMenuLeft, liList, menu;
				var html = angular.element('html');
				var getMenuItem = $parse(iAttrs.drMenuAside);
				var getMenuSelectedIdx = $parse(iAttrs.menuSelected);

				var menuSelectedIdx;
				$timeout(function() {
					menu = iElement.find('.dr-menu').eq(0);
					subMenuEl = iElement.find('.sub-menu');
					subMenuLeft = subMenuEl.position().left;
					liList = menu.children();
					scope.$watch(iAttrs.menuSelected, function(value) {
						highlightMenu(value);
					});

					if (Modernizr.touchevents) {
						iElement.on('click', expandMenu);
						menu.on('click', 'button', menuItemClicked);
						subMenuEl.on('click', function(evt) {
							if (subMenuState === VISIBLE) {
								subMenuEnter();
								evt.stopPropagation();
							}
						});

						angular.element('body').on('touchstart', clickOutside);
						iElement.on('$destory', function() {
							angular.element('body').off('click touchstart', clickOutside);
						});
					} else {
						iElement.on('mouseenter', expandMenu);
						iElement.on('mouseleave', collapseMenu);
						menu.on('mouseenter', '>li', function(evt) {
							switchSubmenu(evt, closePrevSubMenu, openNextSubMenu, false);
						});
						// menu.on('mouseleave', '>li', function(evt) {
						// 	closePrevSubMenu();
						// });
						menu.on('click', 'button', menuItemClicked);
						subMenuEl.on('mouseenter', subMenuEnter);
						subMenuEl.on('mouseleave', subMenuLeave);
					}
					subMenuEl.on('click', 'button', selectSubMenuItem);
				}, 0, false);

				function expandMenu(evt) {
					if (mainMenuState === VISIBLE) {
						controller.menuEnter({width: subMenuLeft});
						mainMenuState = EXPANDED;
						var i = getMenuSelectedIdx(scope);
						var item = getMenuItem(scope)[i];
						if (item.subMenu && item.subMenu.length > 0) {
							openNextSubMenu(i);
						}

						scope.$apply();
					} else if (subMenuState === EXPANDED) {
						//if (evt && angular.element(evt.target).closest().length === 0)
						subMenuLeave();
						switchSubmenu(getMenuSelectedIdx(scope), closePrevSubMenu, openNextSubMenu, false);
					}
				}

				function menuItemClicked(evt) {
					if (mainMenuState === VISIBLE) {
						$timeout(expandMenu, 0, false);
						evt.stopPropagation();
					} else if (mainMenuState === EXPANDED) {
						evt.stopPropagation();
					}
					var i = parseInt(angular.element(evt.currentTarget).closest('li').attr('menu-item-index'), 10);
					var item = getMenuItem(scope)[i];
					switchSubmenu(i, closePrevSubMenu, openNextSubMenu, mainMenuState === EXPANDED);

					if (mainMenuState === EXPANDED) {
						if (item.action) {
							if (subMenuState === EXPANDED) {
								subMenuLeave();
								return;
							}
							item.action();
							getMenuSelectedIdx.assign(scope, i);
							scope.$apply();
							closePrevSubMenu();
							if (html.hasClass('size-mobile')) {
								collapseMenu();
							}
						} else {
							$timeout(subMenuEnter, 1, false);
						}
					}
				}

				function collapseMenu() {
					if (mainMenuState === VISIBLE) {
						return;
					}
					controller.menuLeave(scope);
					animQueue.then(function() {
						TweenMax.set(subMenuEl[0], {x: ASIDE_MENU_WIDTH});
						return Promise.resolve();
					});
					scope.$apply();
					mainMenuState = VISIBLE;
					subMenuState = HIDDEN;
				}

				function closePrevSubMenu() {
					if (subMenuState === HIDDEN) {
						return;
					}
					animQueue.then(function(next) {
						return new Promise(function(resolve) {
							TweenMax.to(subMenuEl[0], 0.25, {x: ASIDE_MENU_WIDTH, ease: 'Power2.easeOut', onComplete: resolve});
						});
					});
					subMenuState = HIDDEN;
				}

				function openNextSubMenu(hoverIdx) {
					if (subMenuState === VISIBLE) {
						return;
					}
					subMenuState = VISIBLE;
					animQueue.then(function() {
						return new Promise(function(resolve) {
							if (hoverIdx === menuSelectedIdx) {
								subMenuEl.addClass('highlight');
							} else {
								subMenuEl.removeClass('highlight');
							}
							TweenMax.killTweensOf(subMenuEl[0]);
							TweenMax.to(subMenuEl[0], 0.25, {x: SUBMENU_EXP_OPEN_LEFT, ease: 'Power2.easeOut', onComplete: resolve});
						});
					});
				}

				function subMenuEnter() {
					if (subMenuState === EXPANDED) {
						return;
					}
					//subMenuEl.off('mouseenter');
					subMenuState = EXPANDED;
					animQueue.then(function() {
						subMenuEl.addClass('highlight');
						return new Promise(function(resolve, reject) {
							TweenMax.killTweensOf(subMenuEl[0]);
							TweenMax.to(subMenuEl[0], 0.25, {x: SUBMENU_EXP_LEFT, ease: 'Power2.easeOut', onComplete: resolve});
							highlightMenu(lastHover);
							scope.$apply();
						});
					});
					controller.menuExpand({width: subMenuEl.prop('offsetWidth') + 66});
					scope.$apply();
					//subMenuEl.on('mouseleave', subMenuLeave);
				}

				function subMenuLeave() {
					if (subMenuState === HIDDEN) {
						return;
					}
					subMenuState = HIDDEN;
					animQueue.then(function() {
						return new Promise(function(resolve, reject) {
							TweenMax.to(subMenuEl[0], 0.25, {x: ASIDE_MENU_WIDTH, ease: 'Power2.easeOut', onComplete: resolve});
							var menuSelectedIdx = getMenuSelectedIdx(scope);
							if (lastHover !== menuSelectedIdx) {
								subMenuEl.removeClass('highlight');
							}
							highlightMenu(menuSelectedIdx);
							scope.$apply();
						});
					});
					controller.menuUnexpand({width: subMenuLeft});
					scope.$apply();
				}

				function highlightMenu(sIndex) {
					if (sIndex == null) {
						return;
					}
					liList.removeClass('dr-checked');
					menuSelectedIdx = parseInt(sIndex, 10);
					var li = liList.eq(menuSelectedIdx);
					li.addClass('dr-checked');
					scope.currSubMenus = getMenuItem(scope)[menuSelectedIdx].subMenu;
					animQueue.then(function(next) {
						subMenuEl.addClass('highlight');
						return Promise.resolve();
					});
				}

				var lastHover;
				function switchSubmenu(evt, closePrev, openNext, skipAnim) {
					var hoverMenuIdx;
					if (_.isNumber(evt)) {
						hoverMenuIdx = evt;
					} else {
						hoverMenuIdx = parseInt(evt.currentTarget.getAttribute('menu-item-index'), 10);
					}
					if (subMenuState !== HIDDEN && hoverMenuIdx === lastHover) {
						return;
					}
					var menuItems = getMenuItem(scope);
					var lastItem = menuItems[lastHover];
					var item = menuItems[hoverMenuIdx];
					if (lastItem && lastItem.subMenu && lastItem.subMenu.length > 0 && !skipAnim) {
						closePrev();
					}
					lastHover = hoverMenuIdx;

					if (item.subMenu && item.subMenu.length > 0) {
						scope.currHoverMenu = getMenuItem(scope)[hoverMenuIdx];
						scope.currSubMenus = scope.currHoverMenu.subMenu;

						scope.$apply();
						if (!skipAnim) {
							$timeout(function() {
								openNext(hoverMenuIdx);
							}, 0, false);
						}
					}
				}

				function selectSubMenuItem(evt) {
					if (subMenuState !== EXPANDED) {
						return;
					}
					var idx = angular.element(evt.currentTarget).closest('li').attr('submenu-item-index');
					idx = parseInt(idx, 10);
					var item = scope.currSubMenus[idx];
					var lis = subMenuEl.find('li');
					lis.removeClass('checked');
					lis.eq(idx).addClass('checked');
					item.action();
					scope.$apply();
					evt.stopPropagation();

					if (html.hasClass('size-mobile')) {
						collapseMenu();
					}
				}

				function clickOutside(evt) {
					if (subMenuState === HIDDEN && mainMenuState !== EXPANDED)
						return;
					var it = angular.element(evt.target).closest(iElement);
					if (it.length === 0) {
						collapseMenu();
					}
				}
			};
		}
	};
}
