const Promise = require('bluebird');
const api = require('__api');
const log = require('log4js').getLogger('wfh.api-loader');
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
	try {
		return Promise.resolve(load(content, loader));
	} catch (e) {
		log.error(e);
		return Promise.reject(e);
	}
}

function parse(source, loader) {
	var file = loader.resourcePath;
	var currPackage = api.findPackageByFile(file);
	var hasApi = false;
	if (currPackage && currPackage.longName !== api.packageName /*@dr-core/webpack2-builder*/ && file === currPackage.file) {
		hasApi = true;
		log.debug('Insert CSS scope classname to:\n %s', file);
		source = `document.getElementsByTagName(\'html\')[0].className += \' ${currPackage.parsedName.name}\';
${source}`;
	}
	var astFromCache = false;
	//log.info('js file: %s, %s', file, _.get(currPackage, 'file'));

	var ast = _.get(loader.query, ['astFromCache', file]);
	if (ast) {
		astFromCache = true;
	}
	try {
		ast = esParser.parse(source, {
			splitLoad: splitPoint => {},
			apiIndentity: () => {
				hasApi = true;
				log.debug('reference __api in %s', file);
			},
			requireApi: () => {
				hasApi = true;
				log.debug('require __api in %s', file);
			}
		}, ast);
	} catch (e) {
		log.error('Failed to parse %s', file);
		throw e;
	}
	if (astFromCache)
		delete loader.query.astFromCache[file];
	//source = loader.query.injector.injectToFile(file, source, ast);
	//loader.query.injector.removeListener('replace', loader.data.onReplaceApiCall);

	if (hasApi) {
		source = apiTmpl({
			packageName: currPackage.longName,
			source: source
		});
	}

	if (currPackage && file === currPackage.file && currPackage.style) {
		var requireCss = Path.relative(Path.dirname(file), currPackage.style).replace(/\\/g, '/');
		if (!_.startsWith(requireCss, '../'))
			requireCss = './' + requireCss;
		log.debug('add pacelify style entry %s', requireCss);
		source = 'require("' + requireCss + '");\n' + source;
	}

	return source;
}

