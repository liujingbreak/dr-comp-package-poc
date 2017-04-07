var _ = require('lodash');
var $ = require('jquery');


module.exports = function(module) {
	module.factory('ScrollableAnim', function() {
		return ScrollableAnim;
	});
};
/**
@param {element} el element or window
@param {number} throttleWait the scroll event listener is actually wrapped in
	lodash.throttle function, this number is to set for throttle's wait parameter.
*/
function ScrollableAnim(el, throttleWait) {
	if (!(this instanceof ScrollableAnim)) {
		return new ScrollableAnim(el, throttleWait);
	}
	if (throttleWait == null)
		throttleWait = 0;
	if (!el)
		el = $(document.body);
	this.panel = el;
	this.scenes = [];
	var self = this;

	this.scrollHandler = _.isNumber(throttleWait) ? _.throttle(onScroll, throttleWait, {leading: true, trailing: true}) : onScroll;

	function onScroll(e) {
		var scrolled = el.scrollTop();
		if (scrolled < 0) {
			return;
		}
		self.seek(scrolled);
	}

	$(window).on('scroll', this.scrollHandler);
}

ScrollableAnim.prototype = {

	/**
	 * attrs: object contains properties like
	 * @param {number} attrs.duration optional property, default value is Math.max of triggerElement's scrollHeight and window height
	 * @param {number} attr.begin : number - also you may use triggerElement instead
	 * @param {element|selector} attrs.triggerElement :  -
	 * @param 	triggered when scrolled distance (scrollTop) reaches element's offset top - viewport's height
	 * @param {number} attrs.delayPercent : - used conjunction with triggerElement,
	 * @param 	triggered when offset reaches delayPercent/100 * duration + element's offset top - viewport's height
	 * @param {TimelineLite|function} attrs.timeline pass in a TimelineLite instance or function(timeline: TimelineLite) to abtain a created `TimelineLite({paused: true})` instance
	 * @param {function} attrs.startup : function(reverse: boolean, animScene: AnimScene)  - where you may put startup animation
	 * @param {function} attrs.teardown : function(reverse: boolean, animScene: AnimScene) - where you may put teardown animation
	 * @param {function} attrs.onScroll : function(progress, time) - progress is a number between  0 and duration,
	 *		time is a number between 0 and 1
	 *
	 *	AnimScene instance's property:
	 *		- .offset = the position of current scollbar - begin
	 *		- .begin = attr.begin value
	 *		- .end = attr.begin + attr.duration
	*/
	scene: function(attrs) {
		var scene = new AnimScene(attrs);
		this.addScene(scene);
		return scene;
	},

	seek: function(position) {
		this.scenes.forEach(function(sc) {
			sc.beat(position);
		});
	},

	/**
	 * To avoid memory leak, must call this to remove element onscroll event handler
	 */
	destory: function() {
		this.panel.off('scroll', this.scrollHandler);
	},

	addScene: function(scene) {
		this.scenes.push(scene);
		scene.scrollPanel = this.panel;
	},


	pin: function(el, top) {
		if (typeof (el) === 'string') {
			el = $(el);
		}
		el = el.first();
		var pinPlaceholder = el.next('.scl-anim-pl');
		if (!pinPlaceholder || pinPlaceholder.length === 0) {
			pinPlaceholder = $('<div class="scl-anim-pl"></div>');
			pinPlaceholder.css({
				display: 'none',
				margin: '0',
				padding: '0'
			});
			el.after(pinPlaceholder);
		}

		var scrollPanelTop = 0;
		var scrollPanelLeft = 0;
		var scrollPanelOffset = this.panel.offset();
		if (scrollPanelOffset) {
			scrollPanelTop = scrollPanelOffset.top;
			scrollPanelLeft = scrollPanelOffset.left;
		}

		// to avoid reflow being forced during rendering, get all needed data before setting css
		var display = el.css('display');
		var ow = el.outerWidth(true);
		var oh = el.outerHeight(true);
		var w = el.css('width');
		var h = el.css('height');
		//var top = el.offset().top;
		var left = el.offset().left;
		pinPlaceholder.addClass(el.prop('className'));
		pinPlaceholder.css({
			display: display,
			width: ow,
			height: oh
		});

		el.css({
			top: top + 'px',
			left: left + 'px',
			position: 'fixed',
			width: w,
			height: h,
		});
	},

	unpin: function(el) {
		if (typeof (el) === 'string') {
			el = $(el);
		}
		el.first().css({
			top: '',
			left: '',
			position: '',
			width: '',
			height: '',
		});

		el.first().next('.scl-anim-pl').css({
			display: 'none'
		});
	}
};

function AnimScene(attrs) {
	_.assign(this, attrs);
	this.begin = this.begin === undefined ? this.offset : this.begin;
	this.status = -1; //not started, 0 - happening, 1 - stopped
	if (this.triggerElement) {
		this.begin = $(this.triggerElement).offset().top - $(window).height();

		if (!this.duration) {
			this.duration = Math.max($(this.triggerElement).prop('scrollHeight'), $(window).height());
		}
		if (this.delayPercent) {
			this.begin += this.delayPercent / 100 * this.duration;
			this.duration = (1 - this.delayPercent / 100) * this.duration; // new duration will be squeezed
		}
	}
	this.end = this.begin + this.duration;
	if (typeof this.timeline === 'function') {
		var callback = this.timeline;
		this.timeline = new TimelineLite({paused: true});
		callback.call(this, this.timeline);
	}
	/** @property scrollPanel - will be setup by ScrollableAmin.addScene()*/
}



AnimScene.prototype = {

	_startup: function(reverse) {
		if (this.startup) {
			this.startup(reverse, this);
		}
	},

	_teardown: function(reverse) {
		if (this.teardown) {
			this.teardown(reverse);
		}
	},

	beat: function(position) {
		// relationship between status and calling startup and teardown
		// status: -1 -> 0: startup(false)
		// status: 1 -> 0: teardown(true)
		// status: 0 -> -1: startup(true)
		// status: 1 -> -1: teardown(true) & startup(true)
		// status: 0 -> 1: teardown(false)
		// status: -1 -> 1: startup(false) & teardown(false)
		this.offset = position;

		if (position >= this.begin && position < this.end) {
			var progress = position - this.begin;
			var time = progress / this.duration;

			if (this.status === -1) {
				this._startup(false);
			} else if (this.status === 1) {
				this._teardown(true);
			}
			if (this.timeline) {
				this.timeline.seek(time);
			}
			if (this.onScroll) {
				this.onScroll(progress, time);
			}
			this.status = 0;
		} else if (this.status !== -1 && position < this.begin) {
			if (this.status === 0) {
				this._startup(true);
			} else if (this.status === 1) {
				this._teardown(true);
				this._startup(true);
			}
			this.status = -1;
			if (this.timeline){
				this.timeline.seek(0);
			}
			if (this.onScroll) {
				this.onScroll(0, 0);
			}
		} else if (this.status !== 1 && position >= this.end) {
			if (this.status === 0) {
				this._teardown(false);
			} else if (this.status === -1) {
				this._startup(false);
				this._teardown(false);
			}

			this.status = 1;
			if (this.timeline) {
				this.timeline.seek(1);
			}
			if (this.onScroll) {
				this.onScroll(this.duration, 1);
			}
		}
	}
};
