require('@dr/angularjs');
var messages = require('@dr/example-i18n/i18n');

angular.module('example-i18n', []).controller('MainController',
function() {
	var mainVm = this;
	mainVm.time = new Date().getTime();
	mainVm.youHaveAMessage = messages['Hellow i18n'];
})
.directive('translate', function() {
	return function(scope, el, attrs) {
		el.html(messages[el.text()]);
	};
});

angular.element(document).ready(function() {
	angular.bootstrap(document, ['example-i18n']);
});
