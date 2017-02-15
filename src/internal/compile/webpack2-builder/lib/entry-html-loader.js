//const Promise = require('bluebird');
const api = require('__api');
const log = require('log4js').getLogger(api.packageName + '.entry-html-loader');
//const _ = require('lodash');
const Path = require('path');

module.exports = function(content) {
	var callback = this.async();
	if (!callback)
		return load(content, this);
	return loadAsync(content, this)
	.then(result => callback(null, result))
	.catch(err => callback(err));
};

function load(content, loader) {
	var file = loader.resourcePath;
	var output = Path.relative(loader.options.context || process.cwd(), file);

	if (!loader._compiler._lego_entry)
		loader._compiler._lego_entry = {};
	loader._compiler._lego_entry[output] = content;
	log.info('add entry html/view %s', output);

	return 'module.exports = null';
}

function loadAsync(content, loader) {
	try {
		return Promise.resolve(load(content, loader));
	} catch (e) {
		log.error(e);
		return Promise.reject(e);
	}
}
