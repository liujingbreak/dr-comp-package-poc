var _ = require('lodash');
var log = require('log4js').getLogger('wfh.module-dep-helper');
var api = require('__api');
var chalk = require('chalk');

module.exports = DependencyHelper;

function DependencyHelper(entryComponents) {
	this.file2comp = {};
	entryComponents.forEach(c => {
		this.file2comp[c.file] = c;
	});
}

DependencyHelper.prototype = {
	/**
	 * @return Map<string, Set>
	 */
	listCommonJsDepMap: function(compilation) {
		var entryPackage2Module = new Map();
		compilation.modules.forEach(m => {
			var comp = this.file2comp[getModuleFile(m)];
			if (comp) {
				var packages = new Set();
				entryPackage2Module.set(comp.longName, packages);
				log.info('%s depends on:', chalk.cyan(comp.longName));
				this._traverseDep(m, packages, {}, 0);
				packages.forEach(c => log.info(chalk.cyan('├─ %s'), c.longName));
			}
		});
		return entryPackage2Module;
	},
	_traverseDep: function(m, packages, traveled, level) {
		_.each(m.dependencies, dep => {
			if (!dep.module || !dep.request)
				return;
			log.debug('%s├─ %s', _.repeat('| ', level + 1), dep.request);
			if (!dep.request.split('!').slice().pop().startsWith('.')) {
				var file = getModuleFile(dep.module);
				if (file) {
					var comp = api.findPackageByFile(file);
					if (comp && comp.dr) {
						packages.add(comp);
					}
				}
			}
			if (_.has(traveled, dep.module.id))
				return;
			traveled[dep.module.id] = 1;
			this._traverseDep(dep.module, packages, traveled, level + 1);
		});
	}
};


function getModuleFile(m) {
	return _.get(m, ['fileDependencies', 0]);
	//return (m.identifier() || m.name).split('!').slice().pop();
}
