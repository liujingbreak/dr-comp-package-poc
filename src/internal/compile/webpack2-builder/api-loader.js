const Promise = require('bluebird');
const api = require('__api');
const log = require('log4js').getLogger(api.packageName + '.api-loader');
const esParser = require('@dr-core/browserify-builder/lib/esParser');
const _ = require('lodash');
const fs = require('fs');
const Path = require('path');
var apiTmpl = _.template(fs.readFileSync(
	Path.join(__dirname, 'apiVariable.js.tmpl'), 'utf8'));

module.exports = function(content) {
	var callback = this.async();
	if (!callback)
		return load(content, this);
	loadAsync(content, this)
	.then(result => callback(null, result))
	.catch(err => callback(err));
};

function load(content, loader) {
	return parse(content, loader);
}

function loadAsync(content, loader) {
	//log.debug(content);
	return Promise.resolve(parse(content, loader));
}

function parse(source, loader) {
	var injector = api.browserInjector;
	var ast;
	var hasApi = false;
	var file = loader.resourcePath;
	var data = api.packageInfo.dirTree.getAllData(file);
	var currPackage;
	if (data.length > 0) {
		currPackage = data[data.length - 1];
		log.debug('package: %s', data[data.length - 1].longName);
	}

	log.debug('file: %s', file);
	try {
		ast = esParser.parse(source, {
			splitLoad: splitPoint => {},
			apiIndentity: () => {hasApi = true;}
		});
	} catch (e) {
		log.error('Failed to parse %s', file);
		throw e;
	}
	injector.on('replace', onReplaceApiCall);
	source = injector.injectToFile(file, source, ast);
	injector.removeListener('replace', onReplaceApiCall);

	if (hasApi) {
		log.debug('reference __api in ' + file);
		source = apiTmpl({
			packageName: currPackage.longName,
			source: source
		});
		log.debug(source);
	}
	function onReplaceApiCall(mName) {
		if (mName === '__api') {
			hasApi = true;
			log.debug('require __api in ' + file);
		}
	}
	return source;
}
