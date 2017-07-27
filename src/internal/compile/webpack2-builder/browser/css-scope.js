exports.writeCssClassToHtml = function(classnames) {
	var htmlDom = document.getElementsByTagName('html')[0];
	classnames = [].concat(classnames);
	for (var i = 0, l = classnames.length; i < l; i++) {
		var cls = classnames[i];
		var r = new RegExp('(?:^|\\s)' + cls + '(?:$|\\s)');
		if (!r.test(htmlDom.className))
			htmlDom.className += ' ' + cls;
	}
};
