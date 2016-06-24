var Promise = require('bluebird');
var _ = require('lodash');
var log = require('log4js').getLogger('packagePriorityHelper');
module.exports = {
	orderPackages: orderPackages
};

var beforeOrAfter = {};
var priorityStrReg = /(before|after)\s+(\S+)/;

function orderPackages(packages, run) {
	var numberTypePrio = [];
	var beforePackages = {};
	var afterPackages = {};

	packages.forEach(pk => {
		if (_.isNumber(pk.priority)) {
			numberTypePrio.push(pk);
		} else if (_.isString(pk.priority)) {
			var res = priorityStrReg.exec(pk.priority);
			if (!res) {
				throw new Error('Invalid format of package.json - priority in ' +
					pk.longName + ': ' + pk.priority);
			}
			var targetPackageName = res[2];
			if (res[1] === 'before') {
				if (!beforePackages[targetPackageName]) {
					beforePackages[targetPackageName] = [];
					beforeOrAfter[targetPackageName] = 1; // track target package
				}
				beforePackages[targetPackageName].push(pk);
			} else if (res[1] === 'after') {
				if (!afterPackages[targetPackageName]) {
					afterPackages[targetPackageName] = [];
					beforeOrAfter[targetPackageName] = 1; // track target package
				}
				afterPackages[targetPackageName].push(pk);
			}
		} else {
			pk.priority = 5000;
			numberTypePrio.push(pk);
		}
	});

	numberTypePrio.sort(function(pk1, pk2) {
		return pk1.priority - pk2.priority;
	});

	var notFound = _.difference(_.keys(beforeOrAfter), _.map(packages, pk => pk.longName));
	if (notFound.length > 0) {
		var err = 'Priority depended packages are not found: ' +  notFound;
		log.error(err);
		return Promise.reject(err);
	}

	function runPackagesSync(packages) {
		var prom = Promise.resolve(null);
		packages.forEach(pk => {
			prom = prom.then(() => {
				return runPackage(pk);
			});
		});
		return prom;
	}

	function runPackagesAsync(packages) {
		return Promise.all(packages.map(runPackage));
	}

	function runPackage(pk) {
		return Promise.coroutine(function*() {
			yield beforeHandlersFor(pk.longName);
			log.debug(pk.longName, ' starts with priority: ', pk.priority);
			yield Promise.resolve(run(pk));
			log.debug(pk.longName, ' ends');
			yield afterHandlersFor(pk.longName);
		})();
		// return beforeHandlersFor(pk.longName)
		// .then(() => {
		// 	log.info(pk.longName, ' starts with priority: ', pk.priority);
		// 	return run(pk);
		// })
		// .then(() => {
		// 	log.info(pk.longName, ' ends');
		// 	return afterHandlersFor(pk.longName);
		// });
	}

	function beforeHandlersFor(name) {
		return runPackagesAsync(beforePackages[name] ? beforePackages[name] : []);
	}

	function afterHandlersFor(name) {
		return runPackagesAsync(afterPackages[name] ? afterPackages[name] : []);
	}

	return runPackagesSync(numberTypePrio);
}
