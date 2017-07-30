const api = require('__api');
const log = require('log4js').getLogger('wfh.api-loader');
const esParser = require('@dr-core/browserify-builder/lib/esParser');
const _ = require('lodash');
const fs = require('fs');
const Path = require('path');
const pify = require('pify');
var apiTmpl = _.template(fs.readFileSync(
	Path.join(__dirname, 'apiVariable.js.tmpl'), 'utf8'));

api.compsHaveCssScope = [];

module.exports = function(content) {
	var callback = this.async();
	if (!callback)
		throw new Error('api-loader is Not a sync loader!');
	loadAsync(content, this)
	.then(result => callback(null, result))
	.catch(err => callback(err));
};

function loadAsync(content, loader) {
	try {
		return parse(content, loader);
	} catch (e) {
		log.error(e);
		loader.emitError(e);
		return Promise.reject(e);
	}
}

function parse(source, loader) {
	var file = loader.resourcePath;
	var currPackage = api.findPackageByFile(file);
	var hasApi = false;
	if (currPackage && !currPackage.dr) {
		log.error('Component has no "dr" property: ', currPackage.longName);
	}
	// if (currPackage && currPackage.longName !== api.packageName /*@dr-core/webpack2-builder*/) {
	// 	let cssScope = _.get(currPackage, 'dr.cssScope');
	// 	if (cssScope !== false && file === currPackage.file) {
	// 		api.compsHaveCssScope.push(currPackage.longName);
	// 		var cls = cssScope;
	// 		if (typeof cls !== 'string')
	// 			cls = currPackage.parsedName.name;
	// 		log.debug('Insert CSS scope classname to:\n %s', file);
	// 		source = `require('@dr-core/webpack2-builder/browser/css-scope').writeCssClassToHtml([\'${cls}\']);
	// ${source}`;
	// 	}
	// }
	var astFromCache = false;
	//log.info('js file: %s, %s', file, _.get(currPackage, 'file'));

	var resolvePromises = [];
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
			},
			es6ImportApi: () => {
				hasApi = true;
				log.debug('ES6 import __api in %s', file);
			},
			dependsStyle: (request) => {
				var p = pify(loader.resolve)(Path.dirname(loader.resourcePath), request);
				resolvePromises.push(p);
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

	var cssScopeCompSet = new Set();
	if (currPackage && file === currPackage.file && currPackage.style) {
		var mainCss = Path.relative(Path.dirname(file), currPackage.style).replace(/\\/g, '/');
		if (!_.startsWith(mainCss, '../'))
			mainCss = './' + mainCss;
		log.debug('add pacelify style entry %s', mainCss);
		source = 'require("' + mainCss + '");\n' + source;
		cssScopeCompSet.add(currPackage);
	}
	return Promise.all(resolvePromises).then((cssfiles)=> {
		for (let cssfile of cssfiles) {
			var comp = api.findPackageByFile(cssfile);
			if (comp == null || comp.dr == null || comp.longName === api.packageName /*@dr-core/webpack2-builder*/)
				continue;
			cssScopeCompSet.add(comp);
		}
		var cls = buildCssScopeClassArray(cssScopeCompSet, file);
		if (cls.length > 0)
			source = `require('@dr-core/webpack2-builder/browser/css-scope').writeCssClassToHtml(${JSON.stringify(cls)});\n` + source;
		return source;
	});
}

function buildCssScopeClassArray(componentSet, file) {
	var cls = [];
	for (let comp of componentSet) {
		let cssScope = _.get(comp, 'dr.cssScope');
		if (cssScope === false)
			log.warn(`${comp.longName} has css files, but its "dr.cssScope" is false which will be ignored.`);
		api.compsHaveCssScope.push(comp.longName);
		if (typeof cssScope !== 'string')
			cls.push(comp.shortName.replace('.', '_'));
		else
			cls.push(cssScope);
	}
	log.debug('Insert CSS scope classname "%s" to:\n %s', cls.join(' '), file);
	return cls;
}

