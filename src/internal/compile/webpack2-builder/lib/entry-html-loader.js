// const api = require('__api');
const log = require('log4js').getLogger('wfh.entry-html-loader');
//const _ = require('lodash');
const Path = require('path');

module.exports = function(content) {
	var callback = this.async();
	if (!callback) {
		this.emitError('Only support async mode');
		throw new Error('Only support async mode');
	}
	loadAsync(content, this)
	.then(result => callback(null, result))
	.catch(err => {
		this.emitError(err);
		log.error(err);
		callback(err);
	});
};

function loadAsync(content, loader) {
	var file = loader.resourcePath;
	var output = Path.relative(loader.options.context || process.cwd(), file);

	if (!loader._compiler._lego_entry)
		loader._compiler._lego_entry = {};

	log.info('add entry html/view %s', output);
	loader._compiler._lego_entry[output] = content;
	return Promise.resolve('module.exports = null');
}
