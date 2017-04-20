var FontFaceObserver = require('fontfaceobserver/fontfaceobserver');
var proxima = new FontFaceObserver('proxima-nova');
var proximaBold = new FontFaceObserver('proxima-nova', {weight: 'bold'});

proxima.load().then(function() {
	if (typeof __api !== 'undefined' && __api.config().devMode)
		console.log('proxima-nova is loaded');
});
proximaBold.load().then(function() {
	if (typeof __api !== 'undefined' && __api.config().devMode)
		console.log('proxima-nova bold is loaded');
});

window.jQuery = require('jquery');
require('@dr/angularjs');
require('@dr/font-awesome-4');

var m = angular.module('docUi', []);
module.exports = m;

require('./animation')(m);
require('./loading.js').create(m);
require('./drDocSelect/drDocSelect.js')(m);
require('./text-anim/textAnim')(m);
