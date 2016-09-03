var gulp = require('gulp');
var _ = require('lodash');
var Promise = require('bluebird');
var config = require('../config');
var cycle = require('cycle');
var fs = require('fs');
var Path = require('path');
var packageUtils = require('../packageMgr/packageUtils');
var log = require('log4js').getLogger('gulp.watchPackages');

module.exports = watch;

function watch(packageList, argv) {
	var dirty = {};

	var packageInfo = JSON.parse(fs.readFileSync(config.resolve('destDir', 'packageInfo.json'), {encoding: 'utf8'}));
	packageInfo = cycle.retrocycle(packageInfo);

	if (packageList) {
		packageList = [].concat(packageList);
		packageUtils.findAllPackages(packageList, watchPackage);
	} else {
		packageUtils.findBrowserPackageByType('*', watchPackage, 'src');
	}

	function watchPackage(name, entryPath, parsedName, json, packagePath) {
		packagePath = fs.realpathSync(packagePath);
		if (_.get(json, 'dr.noWatch') === true) {
			log.info('Skip package %s as its "noWatch: true"', name);
			return;
		}
		log.info('watching package %s  (%s)', name, packagePath);
		var sourceCode = [];
		var assets = [];
		sourceCode.push(packagePath);
		sourceCode.push(packagePath + '/**/*');
		sourceCode.push('!' + packagePath + '/spec/**/*');
		sourceCode.push('!' + packagePath + '/assets/**/*');
		sourceCode.push('!' + packagePath + '/README.md');
		assets.push(packagePath + '/assets/**/*');
		gulp.watch(sourceCode, {
			// debounceDelay: config().gulp.watchDebounceDelay,
			// cwd: packagePath
		}, function(event) {
			var changedPackage = name;
			if (!{}.hasOwnProperty.call(dirty, changedPackage)) {
				dirty[changedPackage] = {};
			}
			if (event.path) {
				var bundle = packageInfo.moduleMap[changedPackage].bundle;
				log.info('event = %j, bundle = %s', event, bundle);
				if (!bundle || Path.relative(packagePath, event.path) === 'package.json') {
					dirty.__all = true;
				}
				dirty[changedPackage].js = true;
				dirty[changedPackage].css = true;
				// if (_.endsWith(event.path, '.js') || _.endsWith(event.path, '.json') || _.endsWith(event.path, '.html')) {
				// 	dirty[changedPackage].js = true;
				// } else if (_.endsWith(event.path, '.less')) {
				// 	dirty[changedPackage].css = true;
				// }
			}
			onChange();
		});
	}

	var buildPromise = Promise.resolve(null);
	var onChange = _.debounce(function() {
		buildPromise = buildPromise
		.then(function() {
			var currDirty = dirty;
			dirty = {};
			if (_.get(currDirty, '__all') === true) {
				log.info('compile all');
				delete argv.p;
				delete argv['only-css'];
			} else {
				argv.p = _.keys(currDirty);
				if (argv.p.length === 0) {
					return null;
				}
				log.debug('building ... ' + argv.p);
				if (argv.p.length === 1 && !currDirty[argv.p[0]].js) {
					argv['only-css'] = true;
				}
				if (argv.p.length === 1 && !currDirty[argv.p[0]].css) {
					argv['only-js'] = true;
				}

				log.debug('changed packages: ' + argv.p);
			}
			return new Promise(function(resolve, reject) {
				gulp.start('compile', function(err) {
					// if (err) {
					// 	reject(err);
					// }
					delete argv.p;
					delete argv['only-css'];
					log.debug('done');
					resolve(null);
				});
			});
		})
		.timeout(config.get('gulp.watchTimeout', 20000))
		.catch(function(e) {
			log.error('compile failure: ', e);
			buildPromise = Promise.resolve(null);
			// If it is caused by timeout, then we need to check 1 more round to see
			// if there are new changes in waiting queue.
			onChange();
		});
	}, config.get('gulp.watchDebounceDelay', 1000));
}
