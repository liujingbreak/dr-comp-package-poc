window.jQuery = require('jquery');
require('./angular-1.4.5/angular.js');
require('./angular-1.4.5/angular-animate.js');
// require('./angular-1.4.5/angular-cookies.js');
require('./angular-1.4.5/angular-route.js');
require('./angular-1.4.5/angular-aria.js');
require('./angular-1.4.5/angular-messages.js');
require('./angular-1.4.5/angular-sanitize');
// require('./angular-1.4.5/angular-touch.js');
require('./angular-1.4.5/angular-resource.js');
if (__api.isLocaleBundleLoaded()) {
	require('@dr/angularjs/i18n');
}
module.exports = angular;
