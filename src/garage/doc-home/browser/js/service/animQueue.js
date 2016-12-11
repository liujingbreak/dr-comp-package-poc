module.exports = AnimQueue;

function AnimQueue() {
	this.q = [];
	this.running = false;
}

AnimQueue.prototype = {
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
