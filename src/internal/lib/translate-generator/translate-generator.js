var Path = require('path');
var api = require('__api');
var log = require('log4js').getLogger(api.packageName);
var glob = require('glob');
var cheerio = require('cheerio');
var fs = require('fs');
var Promise = require('bluebird');
var mkdirp = require('mkdirp');
var yaml = require('js-yaml');
var _ = require('lodash');
var jsParser = require('./jsParser');

var config;

exports.compile = function() {
	config = api.config;
	if (!api.argv.translate) {
		log.debug('Replacing translatable text');
		require('@dr-core/browserify-builder').addTransform(
			require('./translate-replacer').createBrowserifyReplacerTransform(api.getBuildLocale()));
		return null;
	}
	var proms = [];
	if (api.argv.p) {
		api.packageUtils.findAllPackages(api.argv.p, (name, entryPath, parsedName, json, packagePath) => {
			proms.push(scanPackage(packagePath, json));
		}, 'src');
	} else {
		api.packageUtils.findAllPackages((name, entryPath, parsedName, json, packagePath) => {
			proms.push(scanPackage(packagePath, json));
		}, 'src');
	}
	return Promise.all(proms);
};
exports.scanPackage = scanPackage;

var readFileAsync = Promise.promisify(fs.readFile);
var writeFileAsync = Promise.promisify(fs.writeFile);

function scanPackage(packagePath) {
	log.info(packagePath);
	var yamls = {};
	var i18nDir = Path.join(packagePath, 'i18n');
	var existings = {};
	var dirty = false;

	config().locales.forEach(locale => {
		var file = Path.join(i18nDir, 'message-' + locale + '.yaml');
		if (fileExists(file)) {
			log.info('found existing i18n message file: ' + file);
			var contents = fs.readFileSync(file, 'utf8');
			var obj = yaml.safeLoad(contents);
			obj = obj ? obj : {};
			existings[locale] = obj;
			yamls[locale] = contents;
		} else {
			yamls[locale] = '';
		}
	});

	var trackExess = _.cloneDeep(existings);

	var proms = glob.sync(Path.join(packagePath, '/**/*.html').replace(/\\/g, '/')).map(path => {
		return readFileAsync(path, 'utf8').then(content => {
			log.info('scan: ' + path);
			var $ = cheerio.load(content, {decodeEntities: false});
			$('.t').each(onElement);
			$('.dr-translate').each(onElement);
			$('[t]').each(onElement);
			$('[dr-translate]').each(onElement);
			function onElement(i, dom) {
				dirty = doElement($(dom), yamls, existings, trackExess) || dirty;
				return true;
			}
		});
	});

	var promJS = glob.sync(Path.join(packagePath, '/**/*.js').replace(/\\/g, '/')).map(path => {
		return readFileAsync(path, 'utf8').then(content => {
			log.info('scan: ' + path);
			jsParser(content, (key) => {
				dirty = onKeyFound(key, yamls, existings, trackExess) || dirty;
			}, path);
		});
	});

	return Promise.all(proms.concat(promJS)).then(() => {
		log.debug('dirty=' + dirty);
		if (!dirty) {
			return printRedundant(trackExess);
		}
		return new Promise((resolve, reject) => {
			mkdirp(i18nDir, (err) => {
				var indexFile = Path.join(i18nDir, 'index.js');
				if (!fileExists(indexFile)) {
					fs.writeFileSync(indexFile, 'module.exports = require(\'./message-{locale}.yaml\');\n', 'utf8');
				}
				var writeProms = config().locales.map(locale => {
					var fileToWrite = Path.join(i18nDir, 'message-' + locale + '.yaml');
					log.info('write to file ' + fileToWrite);
					return writeFileAsync(fileToWrite, yamls[locale]);
				});
				Promise.all(writeProms).then(resolve);
			});
		}).then(() => {
			return printRedundant(trackExess);
		});
	});
}

function doElement(el, yamls, existing, trackExess) {
	var key;
	var translateAttr = el.attr('dr-translate');
	if (translateAttr && translateAttr !== '') {
		key = translateAttr;
	} else {
		key = el.html();
	}
	log.debug('found key in HTML: ' + key);
	return onKeyFound(key, yamls, existing, trackExess);
}

function onKeyFound(key, yamls, existing, trackExess) {
	log.debug('found key: ' + key);
	var quote = JSON.stringify(key);
	var newLine = quote + ': ' + quote + '\n';
	var dirty = false;
	_.forOwn(yamls, (content, locale) => {
		if (yamls[locale].length > 0 && !(_.endsWith(yamls[locale], '\n') || _.endsWith(yamls[locale], '\r')))
			yamls[locale] += '\n';
		if (_.has(trackExess, locale))
			delete trackExess[locale][key];
		if (!existing[locale] || !_.has(existing[locale], key)) {
			yamls[locale] += newLine;
			_.set(existing, [locale, key], key);
			log.info('+ ' + newLine);
			dirty = true;
		}
	});
	return dirty;
}

function printRedundant(trackExess) {
	_.each(trackExess, (messages, locale) => {
		if (_.size(messages) > 0) {
			log.warn('Redundant message keys are found,' +
			' they are currently not referened from no source code, suggest to remove them from message files.\n' +
			'locale: ' + locale + '\n');
			_.forOwn(messages, (value, key) => {
				log.warn('\t' + key);
			});
		}
	});
}

function fileExists(file) {
	try {
		fs.accessSync(file, fs.R_OK);
		return true;
	} catch (e) {
		return false;
	}
}
