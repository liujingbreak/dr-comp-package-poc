var _ = require('lodash');
var fs = require('fs');
var cheerio = require('cheerio')
var Path = require('path');
var Q = require('q');
var mkdirp = require('mkdirp');
var log = require('@dr/logger').getLogger('browserifyBuilder.pageCompiller');

module.exports = function(packageInfo, bundleDepsGraph, config, dest) {
	log.info('------- compiling entry pages ---------');
	var promises = [];
	_.forOwn(packageInfo.entryPageMap, function(instance, name) {
		log.info('Package ' + name);
		log.debug(instance.entryPage);
		var def = new Q.defer();
		promises.push(def.promise);

		var $ = cheerio.load(fs.readFileSync(instance.entryPage, 'utf-8'));
		createScriptElements($, bundleDepsGraph[name], instance, config);
		var hackedHtml = $.html();

		var htmlName = Path.basename(instance.entryPage);
		var pageRelFolder = Path.relative(instance.packagePath, Path.dirname(instance.entryPage));
		var distFolder = Path.resolve(config().rootPath, config().destDir, instance.shortName, pageRelFolder);
		mkdirp.sync(distFolder);
		var distFilePath = Path.resolve(distFolder, htmlName);
		log.info('writing ' + distFilePath);
		Q.nfcall(fs.writeFile, distFilePath, hackedHtml).then(def.resolve);
	});

	return Q.all(promises);
};



function createScriptElements($, bundleSet, pkInstance, config) {
	var body = $('body');
	if (bundleSet.core) {
		// core is always the first bundle to be loaded
		var scriptEl = $('<script>');
		scriptEl.attr('src', config().staticAssetsURL + '/js/core' + '.js');
		body.append(scriptEl);
	}

	_.forOwn(bundleSet, function(v, bundleName) {
		if (bundleName === 'core') {
			return;
		}
		var scriptEl = $('<script>');
		scriptEl.attr('src', config().staticAssetsURL + '/js/' + bundleName + '.js');
		body.append(scriptEl);
	});
	body.append($('<script>').html('require("' + pkInstance.longName + '");'));
}
