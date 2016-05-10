/* global Modernizr */
require('./modernizr-custom.js');
window.jQuery = require('jquery');
var $ = window.jQuery;
var _ = require('lodash');

module.exports = Modernizr;

var testElement = $('<div>');
testElement.addClass('respond-test');
var html = $('html');

$(document).ready(function() {
	html = $('html');
	$('body').append(testElement);
	checkSize();
	$(window).resize(_.debounce(checkSize, 300, true));
	//detectTouchDevice();
});

// function detectTouchDevice() {
// 	var isTouchDevice = ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch;
// 	return isTouchDevice ? html.addClass('touch-event') : html.removeClass('touch-event');
// }

function checkSize() {
	var newValue = testElement.css('left');
	var oldValue;
	if (newValue === oldValue) {
		return;
	}
	switch (newValue) {
		case '0px':
			html.removeClass('size-mobile size-tablet');
			html.addClass('size-desktop');
			break;
		case '1px':
			html.removeClass('size-mobile size-desktop');
			html.addClass('size-tablet');
			break;
		case '2px':
			html.removeClass('size-tablet size-desktop');
			html.addClass('size-mobile');
			break;
	}
	oldValue = newValue;
}
