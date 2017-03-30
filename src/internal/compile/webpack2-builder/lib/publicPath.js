var api = require('__api');
var _ = require('lodash');
var log = require('log4js').getLogger(api.packageName);

module.exports = publicPath;
module.exports.getLocalIP = getLocalIP;

var localIP;

function publicPath() {
	if (api.config().staticAssetsURL && /^https?:\/\//.test(api.config().staticAssetsURL)) {
		return _.trimEnd(api.config().staticAssetsURL, '/') + '/';
	} else {
		return getDefaultPublicPath() + '/' + _.trimStart(api.config().staticAssetsURL, '/');
	}
}

function getDefaultPublicPath() {
	var ssl = api.config.get('ssl.enabled');
	var port = ssl ? api.config().ssl.port : api.config().port;
	return (ssl ? 'https' : 'http') + '://' + getLocalIP() + (port ? ':' + port : '');
}

function getLocalIP() {
	if (localIP)
		return localIP;
	var os = require('os');
	var ifaces = os.networkInterfaces();
	var ips = [];
	Object.keys(ifaces).forEach(function(ifname) {
		var alias = 0;
		ifaces[ifname].forEach(function(iface) {
			if (iface.family !== 'IPv4' || iface.internal !== false) {
				// skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
				return;
			}

			if (alias >= 1) {
				// this single interface has multiple ipv4 addresses
				log.info(ifname + ':' + alias, iface.address);
			} else {
				// this interface has only one ipv4 adress
				log.info(ifname, iface.address);
			}
			ips.push(iface.address);
			++alias;
		});
	});
	localIP = ips.length === 0 ? 'localhost' : ips[0];
	return localIP;
}
