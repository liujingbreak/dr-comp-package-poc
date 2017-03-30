//const Promise = require('bluebird');
const api = require('__api');
const log = require('log4js').getLogger(api.packageName + '.debug-loader');

module.exports = function(content) {
	var callback = this.async();
	if (!callback)
		return load(content, this);
	loadAsync(content, this)
	.then(result => callback(null, result))
	.catch(err => callback(err));
};

function load(content, loader) {
	log.info(loader._ast);
	log.info('from %s: %s', loader.query.id, loader.resourcePath);
	return content;
}

function loadAsync(content, loader) {
	try {
		return Promise.resolve(load(content, loader));
	} catch (e) {
		log.error(e);
		return Promise.reject(e);
	}
}
