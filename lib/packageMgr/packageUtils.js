module.exports = {
	shortName: shortName
};

var packageNameReg = /(?:@[^\/]+\/)?(\S+)/;
/**
 * turn name like @<scope>/packageA into "packageA"
 * @param  {string} longName package name in package.json
 * @return {string}          [description]
 */
function shortName(longName) {
	var match = packageNameReg.exec(longName);
	return match ? match[1] : longName;
}
