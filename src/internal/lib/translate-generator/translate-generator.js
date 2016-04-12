var Path = require('path');
var log = require('log4js').getLogger('translate-generator');
var glob = require('glob');
var cheerio = require('cheerio');
var fs = require('fs');
var Promise = require('bluebird');
var mkdirp = require('mkdirp');
var yaml = require('js-yaml');
var _ = require('lodash');
var jsParser = require('./jsParser');

var config;

module.exports = {
	compile: function(api) {
		config = api.config;
		if (!api.argv.translate) {
			log.debug('skip');
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
	}
};

var readFileAsync = Promise.promisify(fs.readFile);
var writeFileAsync = Promise.promisify(fs.writeFile);

function scanPackage(packagePath, json) {
	log.debug(packagePath);
	var yamls = {};
	var i18nDir = Path.join(packagePath, 'i18n');
	var existings = {};
	var dirty = false;

	config().locales.forEach(locale => {
		var file = Path.join(i18nDir, 'message-' + locale + '.yaml');
		if (fileExists(file)) {
			log.debug('found existing i18n message file: ' + file);
			var contents = fs.readFileSync(file, 'utf8');
			var obj = yaml.safeLoad(contents);
			obj = obj ? obj : {};
			existings[locale] = obj;
			yamls[locale] = contents;
		} else {
			yamls[locale] = '';
		}
	});

	var proms = glob.sync(Path.join(packagePath, '/**/*.html').replace(/\\/g, '/')).map(path => {
		return readFileAsync(path, 'utf8').then(content => {
			log.debug('scan: ' + path);
			var $ = cheerio.load(content);
			$('.t').each((i, dom) => {
				dirty = doElement($(dom), yamls, existings);
			});
			$('[translate]').each((i, dom) => {
				dirty = doElement($(dom), yamls, existings);
			});
		});
	});

	var promJS = glob.sync(Path.join(packagePath, '/**/*.js').replace(/\\/g, '/')).map(path => {
		return readFileAsync(path, 'utf8').then(content => {
			log.debug('scan: ' + path);
			jsParser(config, content, (key) => {
				dirty = onKeyFound(key, yamls, existings);
			});
		});
	});

	return Promise.all(proms.concat(promJS)).then(() => {
		if (!dirty) {
			return null;
		}
		return new Promise((resolve, reject) => {
			mkdirp(i18nDir, (err) => {
				var indexFile = Path.join(i18nDir, 'index.js');
				if (!fileExists(indexFile)) {
					fs.writeFileSync(indexFile, 'module.exports = require(\'./message-{locale}.yaml\');\n', 'utf8');
				}

				var writeProms = config().locales.map(locale => {
					var fileToWrite = Path.join(i18nDir, 'message-' + locale + '.yaml');
					log.debug('write to file ' + fileToWrite);
					return writeFileAsync(fileToWrite, yamls[locale]);
				});
				Promise.all(writeProms).then(resolve);
			});
		});
	});
}

function doElement(el, yamls, existing) {
	var key;
	var translateAttr = el.attr('translate');
	if (translateAttr && translateAttr !== '') {
		key = translateAttr;
	} else {
		key = el.text();
	}
	log.debug('found key in HTML: ' + key);
	return onKeyFound(key, yamls, existing);
}

function onKeyFound(key, yamls, existing) {
	var quote = JSON.stringify(key);
	var newLine = quote + ': ' + quote + '\n';
	var dirty = false;
	_.forOwn(yamls, (content, locale) => {
		if (!existing[locale] || !{}.hasOwnProperty.call(existing[locale], key)) {
			yamls[locale] += newLine;
			dirty = true;
		}
	});
	return dirty;
}

function fileExists(file) {
	try {
		fs.accessSync(file, fs.R_OK);
		return true;
	} catch (e) {
		return false;
	}
}
