var FontFaceObserver = require('fontfaceobserver/fontfaceobserver');
var font = new FontFaceObserver('FontAwesome');

font.load().then(function() {
	if (typeof __api !== 'undefined' && __api.config().devMode)
		console.log('FontAwesome is loaded');
});
