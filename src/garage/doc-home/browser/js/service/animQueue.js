var Promise = require('bluebird');

module.exports = AnimQueue;

function AnimQueue() {
	this.q = [];
	this.running = false;
}

AnimQueue.prototype = {
	thenno: function(actionFunc) {
		var self = this;
		if (typeof actionFunc !== 'function') {
			var params = [].slice.call(arguments);
			var defer = Promise.defer();
			params.forEach(function(p) {
				if (typeof p === 'object') {
					var originComp = p.onComplete;
					p.onComplete = function() {
						if (originComp) {
							originComp();
						}
						defer.resolve();
					};
				}
			});
			actionFunc = function() {
				try {
					console.log(params);
					TweenMax.to.apply(TweenMax, params);
				} catch (e) {
					defer.reject(e);
				}
				return defer.promise;
			};
		}
		if (!self.promise) {
			self.promise = Promise.resolve(actionFunc());
		} else {
			self.promise = self.promise
			.then(actionFunc, function(e) {
				console.log(e);
				self.promise = null;
			});
		}
	},

	then: function(action) {
		var self = this;
		self.q.push(action);
		if (self.q.length > 10) {
			this.running = false;
			console.log(self.q[0].toString());
		}
		self._run();
	},

	_run: function() {
		var self = this;
		if (this.running) {
			return;
		}
		var t = this.q.shift();
		if (t) {
			var timer;
			this.running = true;
			t().then(function() {
				clearTimeout(timer);
				self.running = false;
				self._run();
				return null;
			});
			timer = setTimeout(function() {
				if (self.running) {
					console.log('timeout ' + t.toString());
					self.running = false;
					self._run();
				}
			}, 350);
		}
	}
};
