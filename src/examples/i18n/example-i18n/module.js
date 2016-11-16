require('@dr/angularjs');
require('./i18n');

angular.module('example-i18n', [])
.controller('MainController', ['$interval', '$compile', function($interval, $compile) {
	var mainVm = this;
	mainVm.time = new Date().getTime();
	mainVm.youHaveAMessage = drTranslate('Hellow i18n');
	mainVm.i18nText1 = drTranslate('i18nText1-key');
	mainVm.i18nText2 = drTranslate('i18nText2-key');
	$interval(function() {
		mainVm.time = new Date().getTime();
	}, 1000);

	mainVm.templateContent = require('./template.html');
}]);

angular.element(document).ready(function() {
	angular.bootstrap(document, ['example-i18n']);
});
