
exports.glob2regexp = glob2regexp;

function glob2regexp(str) {
	var replacements = [];
	var i = 0;
	while (i >= 0) {
		i = str.indexOf('.', i);
		if (i >= 0) {
			replacements.push({start: i, end: i + 1, replacement: '\\.'});
			i++;
		} else
			break;
	}
	i = 0;
	while (i >= 0) {
		i = str.indexOf('**/', i);
		if (i >= 0) {
			replacements.push({start: i, end: i + '**/'.length, replacement: '(?:[^\\\\/]+[/\\\\])*'});
			i++;
		} else
			break;
	}
	i = 0;
	while (i >= 0) {
		i = str.indexOf('*', i);
		if (i >= 0) {
			if (str.charAt(i - 1) !== '*' && str.charAt(i + 1) !== '*') {
				replacements.push({start: i, end: i + 1, replacement: '[^/\\\\]+'});
			}
			i++;
		} else
			break;
	}
	var reg = patchText(str, replacements) + '$';
	//log.debug(reg);
	return reg;
}

function patchText(text, replacements) {
	replacements.sort(function(a, b) {
		return a.start - b.start;
	});
	var offset = 0;
	return replacements.reduce(function(text, update) {
		var start = update.start + offset;
		var end = update.end + offset;
		var replacement = update.replacement;
		offset += (replacement.length - (end - start));
		return text.slice(0, start) + replacement + text.slice(end);
	}, text);
}
