var gulp = require('gulp');
var _ = require('lodash');
var packageUtils = require('../packageMgr/packageUtils');
var log = require('log4js').getLogger('gulp.watchPackages');

module.exports = watch;

function watch(packageList, argv) {
	var dirty = {};

	if (packageList) {
		packageList = [].concat(packageList);
		packageUtils.findAllPackages(packageList, onFind);
	} else {
		packageUtils.findBrowserPackageByType('*', onFind);
	}

	function onFind(name, entryPath, parsedName, json, packagePath) {
		log.info('watching package ' + name);
		var sourceCode = [];
		var assets = [];
		sourceCode.push(packagePath + '/**/*.*');
		sourceCode.push('!' + packagePath + '/spec/**/*');
		sourceCode.push('!' + packagePath + '/assets/**/*');
		assets.push(packagePath + '/assets/**/*');
		gulp.watch(sourceCode, {
			debounceDelay: 1000
		}, function(event) {
			log.info(event);
			var changedPackage = parsedName.name;
			if (!{}.hasOwnProperty.call(dirty, changedPackage)) {
				dirty[changedPackage] = {};
			}
			if (event.path) {
				if (_.endsWith(event.path, '.js') || _.endsWith(event.path, '.json') || _.endsWith(event.path, '.html')) {
					dirty[changedPackage].js = true;
				} else if (_.endsWith(event.path, '.less')) {
					dirty[changedPackage].css = true;
				}
			}
			onChange();
		});
	}

	var buildPromise = Promise.resolve(null);
	var onChange = _.debounce(function() {
		buildPromise = buildPromise.then(function() {
			var currDirty = dirty;
			dirty = {};
			argv.p = _.keys(currDirty);
			log.debug('building ... ' + argv.p);
			if (argv.p.length === 1 && !currDirty[argv.p[0]].js) {
				argv['only-css'] = true;
			}

			log.debug('changed packages: ' + argv.p);

			return new Promise(function(resolve, reject) {
				gulp.start('compile', function(err) {
					delete argv.p;
					delete argv['only-css'];
					log.debug('done');
					resolve();
				});
			});
		}).catch(function(e) {
			log.error(e);
		});
	}, 1200);
}
