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
		var entryPackage2css = new Map();
		compilation.modules.forEach(m => {
			var file = getModuleFile(m);
			if (!file)
				return;
			var comp = this.file2comp[file];
			if (comp) {
				var packages = new Set();
				var cssPackages = new Set();
				entryPackage2Module.set(comp.longName, packages);
				entryPackage2css.set(comp.longName, cssPackages);
				log.info('%s depends on:', chalk.cyan(comp.longName));
				this._traverseDep(m, packages, cssPackages, new Set(), 0);
				packages.forEach(c => log.info(chalk.cyan('├─ %s %s'), c.longName,
					cssPackages.has(c) ? '' : '(no CSS)'));
			}
		});
		return {
			packageMap: entryPackage2Module,
			cssPackageMap: entryPackage2css
		};
	},
	_traverseDep: function(m, packages, cssPackages, traveled, level) {
		_.each(m.dependencies, dep => {
			if (!dep.module || !dep.request)
				return;
			if (traveled.has(dep.module))
				return;
			traveled.add(dep.module);
			var shortRequest = dep.request.split('!').slice().pop();
			log.debug('%s├─ %s', _.repeat('| ', level + 1), shortRequest);
			//if (!dep.request.split('!').slice().pop().startsWith('.')) {
			var file = getModuleFile(dep.module);
			if (file) {
				var comp = api.findPackageByFile(file);
				if (comp && comp.dr) {
					packages.add(comp);
				}
				if (file.endsWith('.less') || file.endsWith('.scss') || file.endsWith('.css'))
					cssPackages.add(comp);
			}
			//}
			this._traverseDep(dep.module, packages, cssPackages, traveled, level + 1);
		});
	},

};


function getModuleFile(m) {
	return m.resource || (m.rootModule && m.rootModule.resource) || null;
	//return (m.identifier() || m.name).split('!').slice().pop();
}
