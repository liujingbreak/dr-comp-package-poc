var api = require('__api');

api.app.component('compCard', {
	controller: [function() {
		this.$onInit = function() {
			console.log(this.package);
		};
	}],
	template: require('../views/comp-card.html'),
	bindings: {
		package: '<'
	}
});
