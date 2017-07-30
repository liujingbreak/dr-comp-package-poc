var classAddedSet;
var htmlDom;
var has = Object.prototype.hasOwnProperty;

exports.writeCssClassToHtml = function(classnames) {
	if (!classAddedSet)
		classAddedSet = init();
	for (var i = 0, l = classnames.length; i < l; i++) {
		var cls = classnames[i];
		if (!has.call(classAddedSet, cls)) {
			htmlDom.className += ' ' + cls;
			classAddedSet[cls] = true;
		}
	}
};

function init() {
	var classAddedSet = {};
	htmlDom = document.getElementsByTagName('html')[0];
	var classes = htmlDom.className.split(' ');
	for (var i = 0, l = classes.length; i < l; i++) {
		if (classes[i].length > 0)
			classAddedSet[classes[i]] = true;
	}
	return classAddedSet;
}
