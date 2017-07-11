const api = require('__api');
const log = require('log4js').getLogger(api.packageName + '.entry-html-loader');
//const _ = require('lodash');
const Path = require('path');
//const vm = require('vm');

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
	// return evaluate(content, file)
	// .then(result => {
	// 	loader._compiler._lego_entry[output] = result;
	// 	return 'module.exports = null';
	// });
}

// function evaluate(source, filename) {
// 	var m = {exports: {}};
// 	var vmContext = vm.createContext(_.assign({require: require, module: m}, global));
// 	var vmScript = new vm.Script(source, {filename: filename});
// 	// Evaluate code and cast to string
// 	var newSource;
// 	try {
// 		newSource = vmScript.runInContext(vmContext);
// 	} catch (e) {
// 		return Promise.reject(e);
// 	}
// 	if (typeof newSource === 'object' && newSource.__esModule && newSource.default) {
// 		newSource = newSource.default;
// 	}
// 	return typeof newSource === 'string' || typeof newSource === 'function' ? Promise.resolve(newSource)
// 		: Promise.reject('The loader for "' + filename + '" didn\'t return html.');
// }
