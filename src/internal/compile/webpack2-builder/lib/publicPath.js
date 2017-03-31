var api = require('__api');
var _ = require('lodash');
var log = require('log4js').getLogger(api.packageName);

module.exports = publicPath;
module.exports.getLocalIP = getLocalIP;

var localIP;

function publicPath() {
	var prefix = api.config().staticAssetsURL ? api.config().staticAssetsURL : '';
	if (/^https?:\/\//.test(prefix)) {
		return urlJoin(prefix, (api.isDefaultLocale() ? '' : '/' + api.getBuildLocale()));
	} else {
		return urlJoin(getDefaultPublicPath(), prefix, (api.isDefaultLocale() ? '' : '/' + api.getBuildLocale()));
	}
}

function urlJoin(...paths) {
	var joined = '';
	paths.forEach((p, i)=> {
		p = _.trim(p, '/');
		if (p.length > 0) {
			if (joined.length > 0)
				joined += '/';
			joined += p;
		}
	});
	return joined;
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
