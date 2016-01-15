module.exports = {
	parseName: parseName
};

var packageNameReg = /(?:@([^\/]+)\/)?(\S+)/;
/**
 * turn name like @<scope>/packageA into "packageA"
 * @param  {string} longName package name in package.json
 * @return {{scope: string, name: string}}
 */
function parseName(longName) {
	var ret = {name: longName};
	var match = packageNameReg.exec(longName);
	if (match) {
		ret.scope = match[1];
		ret.name = match[2];
	}
	return ret;
}
