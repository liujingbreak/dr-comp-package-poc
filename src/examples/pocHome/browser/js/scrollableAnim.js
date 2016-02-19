var _ = require('lodash');
var $ = require('jquery');

module.exports = ScrollableAnim;
/**
attrs: object contains properties like
	- duration : number
	- offset : number - also you may use triggerElement instead
	- triggerElement: element|selector -
		triggered when offset reaches element's offset top - viewport's height
	- delayPercent: number - used conjunction with triggerElement,
		triggered when offset reaches delayPercent/100 * duration + element's offset top - viewport's height
	- timeline: TimelineLite
	- startup: function(reverse: boolean)  - where you may put startup animation
	- teardown: function(reverse: boolean) - where you may put teardown animation
	- onScroll: function(progress, time) - progress is a number between  0 and duration,
		time is a number between 0 and 1
*/
function AnimScene(attrs) {
	_.assign(this, attrs);

	this.status = -1; //not started, 0 - happening, 1 - stopped
	if (this.triggerElement) {
		this.offset = $(this.triggerElement).offset().top - $(window).height();

		if (!this.duration) {
			this.duration = Math.max($(this.triggerElement).prop('scrollHeight'), $(window).height());
		}
		if (this.delayPercent) {
			this.offset += this.delayPercent / 100 * this.duration;
			this.duration = (1 - this.delayPercent / 100) * this.duration; // new duration will be squeezed
		}
	}
	this.end = this.offset + this.duration;


	/** @property scrollPanel - will be setup by ScrollableAmin.addScene()*/
}



AnimScene.prototype = {

	_startup: function(reverse) {
		if (this.startup) {
			this.startup(reverse);
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

		if (position >= this.offset && position < this.end) {
			var progress = position - this.offset;
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
		} else if (this.status !== -1 && position < this.offset) {
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

/**
@param el element or window
*/
function ScrollableAnim(el) {
	this.panel = el;
	this.scenes = [];
	var self = this;
	el.on('scroll', function(e) {
		setTimeout(function() {
			var scrolled = el.scrollTop();
			if (scrolled < 0) {
				return;
			}
			self.scenes.forEach(function(sc) {
				sc.beat(scrolled);
			});
		}, 0);
	});
}

ScrollableAnim.prototype = {
	scene: function(attrs) {
		var scene = new AnimScene(attrs);
		this.addScene(scene);
		return scene;
	},

	addScene: function(scene) {
		this.scenes.push(scene);
		scene.scrollPanel = this.panel;
	},


	pin: function(el) {
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

		console.log('pin at ' + (el.offset().top - scrollPanelTop - this.panel.scrollTop()));

		// to avoid reflow being forced during rendering, get all needed data before setting css
		var display = el.css('display');
		var ow = el.outerWidth(true);
		var oh = el.outerHeight(true);
		var w = el.css('width');
		var h = el.css('height');
		var top = el.offset().top;
		var left = el.offset().left;
		pinPlaceholder.addClass(el.prop('className'));
		pinPlaceholder.css({
			display: display,
			width: ow,
			height: oh
		});

		el.css({
			top: top - scrollPanelTop - this.panel.scrollTop() + 'px',
			left: left - scrollPanelLeft - this.panel.scrollLeft() + 'px',
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
