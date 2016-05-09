window.jQuery = require('jquery');
var $ = window.jQuery;
var _ = require('lodash');

var testElement = $('<div>');
testElement.addClass('respond-test');
var html = $('html');

$(document).ready(function() {
	$('body').append(testElement);
	checkSize();
	$(window).resize(_.debounce(checkSize, 300, true));
});

function checkSize() {
	var newValue = testElement.css('left');
	var oldValue;
	if (newValue === oldValue) {
		return;
	}
	switch (newValue) {
		case '0px':
			html.removeClass('mobile tablet');
			html.addClass('desktop');
			break;
		case '1px':
			html.removeClass('mobile desktop');
			html.addClass('tablet');
			break;
		case '2px':
			html.removeClass('tablet desktop');
			html.addClass('mobile');
			break;
	}
	oldValue = newValue;
}
