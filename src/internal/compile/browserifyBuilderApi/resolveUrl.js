var _ = require('lodash');
var packageNameReg = /(?:@([^\/]+)\/)?(\S+)/;

module.exports = resolveUrl;

function resolveUrl(config, packageName, path) {
	packageName = packageNameReg.exec(packageName)[2];
	if (_.startsWith(path, '/')) {
		path = path.substring(1);
	}
	var staticAssetsURL = config().staticAssetsURL;
	if (_.endsWith(staticAssetsURL, '/')) {
		staticAssetsURL = staticAssetsURL.substring(0, staticAssetsURL.length - 1);
	}
	return staticAssetsURL + '/' + packageName + '/' + path;
}
