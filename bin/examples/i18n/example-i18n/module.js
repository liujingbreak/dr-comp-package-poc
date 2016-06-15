require('@dr/angularjs');
var messages;
if (__api.isLocaleBundleLoaded()) {
	messages = require('@dr/example-i18n/i18n');
}

angular.module('example-i18n', []).controller('MainController',
function() {
	var mainVm = this;
	mainVm.time = new Date().getTime();
	mainVm.youHaveAMessage = messages['Hellow i18n'];
	mainVm.i18nText1 = $translate('i18nText1-key');
	mainVm.i18nText2 = $translate('i18nText2-key', 'param1', 'param2');
})
.directive('translate', function() {
	return function(scope, el, attrs) {
		el.html(messages[el.text()]);
	};
});

angular.element(document).ready(function() {
	angular.bootstrap(document, ['example-i18n']);
});
