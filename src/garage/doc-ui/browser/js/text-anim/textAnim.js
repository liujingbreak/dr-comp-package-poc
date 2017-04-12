require('./text-anim.less');
var _ = require('lodash');
var api = require('__api');

module.exports = function(ngModule) {
	api.extend({
		textElementSplit: textElementSplit
	});

	ngModule.directive('drSplitTextShow', ['$compile', function($compile) {
		return {
			bindToController: {
				onSplitDone: '&',
				onShow: '&',
				drSplitTextShow: '<', // if `true` anim starts
				timeline: '=',
				onComplete: '&',
				timelinePos: '@',
				splitByWord: '@'
				//duration: '@'
			},
			compile: function(iElement, tAttrs, transclude) {
				iElement.addClass('dr-text-anim');
				var children = textElementSplit(iElement, tAttrs.splitByWord === 'true');
				iElement.html('');
				iElement.append(children);
				//return $compile(iElement);
				return function() {};
			},

			controllerAs: '$ctrl',
			controller: ['$element', '$scope', '$attrs', function($element, scope, $attrs) {
				// this.$onChanges = function(changesObj) {

				// };
				var self = this;
				this.$postLink = function() {
					var timeline;
					if (self.timeline) {
						timeline = self.timeline;
					} else {
						timeline = new TimelineLite({paused: true});
					}
					console.log(0.06 * $element[0].children.length);
					timeline.staggerFromTo($element[0].children, $element[0].children.length * 0.02,
						{autoAlpha: 0, xPercent: -67},
						{autoAlpha: 1, xPercent: 0, ease: 'Power2.easeout',
							onComplete: function() {
								$element.children().css('opacity', '');
								self.drSplitTextShow = false;
								scope.$apply();
								if (self.onComplete) {
									self.onComplete();
								}
							}
						},
						0.08,
						self.timelinePos ? self.timelinePos : '+=0'
					);

					if ($attrs.drSplitTextShow) {
						scope.$watch(function() { return self.drSplitTextShow;}, function(newVal) {
							if (newVal) {
								timeline.restart();
							}
						});
					}
				};
			}]
		};
	}]);
};

function textElementSplit(el, splitByWord, copyClassName) {
	var appendTo = [];
	_.each(el[0].childNodes, function(node) {
		if (node.nodeName === '#text') {
			_.each(splitByWord ? textToWordArray(_.trim(node.textContent)) : node.textContent.split(''), function(chr) {
				var span = angular.element('<span>');
				if (copyClassName)
					span.addClass(el.prop('className'));
				span.html(chr === ' ' ? '&nbsp;' : chr);
				appendTo.push(span);
			});
		} else {
			var nodeEl = angular.element(node);
			var children = textElementSplit(nodeEl, splitByWord, true);
			[].push.apply(appendTo, children);
		}
	});
	return appendTo;
}

function textToWordArray(str) {
	var res = [];
	var wordEnd = true;
	_.times(str.length, function(i) {
		var c = str.charAt(i);
		if (/\w/.test(c)) {
			if (wordEnd)
				res.push(c);
			else
				res[res.length - 1] += c;
			wordEnd = false;
		} else if (/\s/.test(c)) {
			if (res.length > 0)
				res[res.length - 1] += '&nbsp;';
			else
				res.push('&nbsp;');
			wordEnd = true;
		} else {
			res.push(c);
			wordEnd = true;
		}
	});
	return res;
}
