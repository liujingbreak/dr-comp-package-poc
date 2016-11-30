var Path = require('path');
var through = require('through2');
var acorn = require('acorn');
var api = require('__api');
var _ = require('lodash');
var log = require('log4js').getLogger(api.packageName);
var cheerio = require('cheerio');
var jsParser = require('./jsParser');
var patchText = require('./patch-text');
var bResolve = require('browser-resolve');
var yamljs = require('yamljs');
var fs = require('fs');

exports.createBrowserifyReplacerTransform = createBrowserifyReplacerTransform;

function createBrowserifyReplacerTransform(locale) {
	var skipPackageCache = {};
	return function(file) {
		log.debug('Replace file %s', file);
		var source = '';
		var ext = Path.extname(file).toLowerCase();
		//var basename = Path.basename(file);
		if (ext === '.js') {
			return through(function(chunk, enc, next) {
				source += chunk;
				next();
			}, function(cb) {
				try {
					this.push(replaceJS(source, file, locale, skipPackageCache));
				} catch (e) {
					this.emit('error', e);
				}
				cb();
			});
		} else if (ext === '.html') {
			return through(function(chunk, enc, next) {
				source += chunk;
				next();
			}, function(cb) {
				try {
					this.push(replaceHtml(source, file, locale, skipPackageCache));
				} catch (e) {
					this.emit('error', e);
				}
				cb();
			});
		} else {
			return through();
		}
	};
}

function replaceJS(source, file, locale, skipPackageCache) {
	var res = checkSkipPackageAndGetRes(file, locale, skipPackageCache);
	if (!res)
		return source;
	var ast = acorn.parse(source, {locations: true});
	var replacements = [];
	jsParser(source, (keyNode, callExpNode) => {
		if (!_.has(res, keyNode))
			log.warn('missing i18n message for: %s', keyNode);
		var replaced = res[keyNode];
		replacements.push({
			start: callExpNode.start,
			end: callExpNode.end,
			replacement: '"' + replaced + '"'
		});
		log.debug('Replace JS i18n message "%s" with:\n%s', keyNode, replaced);
	}, file, ast);
	return patchText(source, replacements);
}

exports.htmlReplacer = function(source, file, locale) {
	var skipPackageCache = {};
	return function(source, file, locale) {
		return replaceHtml(source, file, locale, skipPackageCache);
	};
};

function replaceHtml(source, file, locale, skipPackageCache) {
	var res = checkSkipPackageAndGetRes(file, locale, skipPackageCache);
	if (!res)
		return source;
	var $ = cheerio.load(source, {decodeEntities: false});
	$('.t').each(onElement);
	$('.dr-translate').each(onElement);
	$('[t]').each(onElement);
	$('[dr-translate]').each(onElement);

	function onElement(i, dom) {
		var el = $(dom);
		var key = el.html();
		// if (!_.has(res, key))
		// 	log.debug('missing i18n message for: %s', key);
		el.html(res[key]);
		log.debug('Replace HTML i18n message "%s" with:\n%s', key, res[key]);
	}
	return $.html();
}

function checkSkipPackageAndGetRes(file, locale, skipPackageCache) {
	var drPackage = api.findBrowserPackageInstanceByPath(file);
	if (!drPackage || skipPackageCache && _.has(skipPackageCache, drPackage.longName)) {
		//log.debug('skip file: %s', file);
		return false;
	} else if (!drPackage.translatable) {
		log.debug('skip non-translatable package file: %s', file);
		skipPackageCache[drPackage.longName] = 1;
		return false;
	}
	var solved;
	var resName = drPackage.longName + '/i18n/message-' + locale + '.yaml';
	try {
		solved = bResolve.sync(resName, {paths: api.compileNodePath});
	} catch (e) {
		solved = false;
	}
	return solved ? yamljs.parse(fs.readFileSync(require.resolve(resName), 'utf8')) : false;
}
