var log = require('log4js').getLogger('wfh.ManualChunkPlugin');
var logFd = log; //require('log4js').getLogger('wfh.ManualChunkPlugin.fd');
var logD = log; //require('log4js').getLogger('wfh.ManualChunkPlugin.d');

var divideLog = require('log4js').getLogger('wfh.ManualChunkPlugin.divideModule');
var _ = require('lodash');
var Path = require('path');
var api = require('__api');
var Tapable = require('tapable');
var chalk = require('chalk');
var nextIdent = 0;

var showDependency = api.config.get(['manual-chunk-plugin', 'showDependency'], false);
var showFileDep = api.config.get(['manual-chunk-plugin', 'showFileDependency'], true);

/**
 * ManualChunkPlugin
 * @param {string} opts.manifest name runtime chunk
 * @param {string} opts.defaultChunkName when encountering a module has not chunk name setting,
 * move it to a default chunk with name of this value
 * @param {function(file: string)} opts.getChunkName a function callback used to provide chunk name to which file belongs
 */
function ManualChunkPlugin(opts) {
	Tapable.call(this);
	this.ident = __filename + (nextIdent++);
	this.opts = opts;
	if (!opts.manifest)
		opts.manifest = 'manifest';
}

module.exports = ManualChunkPlugin;
ManualChunkPlugin.prototype = _.create(Tapable.prototype);
ManualChunkPlugin.prototype.apply = function(compiler) {
	var plugin = this;
	var ident = this.ident;

	compiler.plugin('compilation', function(compilation) {
		if (compilation.compiler.parentCompilation)
			return; // Skip child compilation like what extract-text-webpack-plugin creates
		var bundleInitialChunkMap = {}; // a hash object, key: bundle name, value: chunk instance
		var bundleAsyncChunkMap = {}; // a hash object, key: bundle name, value: chunk instance

		compilation.plugin(['optimize-chunks', 'optimize-extracted-chunks'], function(chunks) {
			// only optimize once
			if (compilation[ident])
				return;
			compilation[ident] = true;
			log.debug('optimize: %s', chunks.map(c => c.name).join(', '));
			//printChunks(compilation, chunks);

			chunks.forEach(chunk => {
				if (chunk.name ) {
					if (chunk.isInitial())
						bundleInitialChunkMap[chunk.name] = chunk;
					else
						bundleAsyncChunkMap[chunk.name] = chunk;
				}
			});

			divideModule.call(plugin, compilation, chunks, bundleInitialChunkMap, bundleAsyncChunkMap);
		});
	});
	compiler.plugin('emit', function(compilation, callback) {
		log.debug(_.pad(' emit ', 40, '-'));
		printChunks(compilation, compilation.chunks);
		callback();
	});

	function divideModule(compilation, chunks, bundleInitialChunkMap, bundleAsyncChunkMap) {
		divideLog.debug(_.repeat('-', 10) + ' divide module ' + _.repeat('-', 10));
		chunks = chunks.slice();
		// create initial manifest chunk
		var self = this;

		var divededChunkMap = {};
		chunks.forEach(chunk => {
			var divededChunkSet = divededChunkMap[chunk.debugId] = {};
			var isInitialChunk = chunk.isInitial();
			divideLog.debug('Scan original chunk [%s]', getChunkName(chunk));

			_.each(chunk.modules.slice(), (m, idx) => {
				divideLog.debug('\tscan module (%s)', simpleModuleId(m));
				var file = _.get(m, ['fileDependencies', 0]);
				if (!file)
					return;
				var bundle;
				if (self.opts.getChunkName)
					bundle = self.opts.getChunkName(file);

				if (bundle == null) {
					divideLog.warn('Use chunk [%s] for %s', self.opts.defaultChunkName,
						chalk.red(Path.relative(compiler.options.context || process.cwd(), file)));
					bundle = self.opts.defaultChunkName;
				}
				if (chunk.name == null) {
					if (isInitialChunk && !_.has(bundleInitialChunkMap, bundle)) {
						chunk.name = bundle;
						bundleInitialChunkMap[bundle] = chunk;
						return;
					} else if (!isInitialChunk && !_.has(bundleAsyncChunkMap, bundle)) {
						chunk.name = 'splitload-' + bundle;
						bundleAsyncChunkMap[bundle] = chunk;
						return;
					}
				}
				if (bundle === chunk.name) {
					if (isInitialChunk)
						bundleInitialChunkMap[bundle] = chunk;
					else
						bundleAsyncChunkMap[bundle] = chunk;
					return;
				}
				onEachChunk.call(compilation, bundleInitialChunkMap, bundleAsyncChunkMap, m, bundle, divededChunkSet, chunk, isInitialChunk);
			});
			divideLog.debug('');
		});

		removeEmptyChunk(compilation);

		var manifestChunk = compilation.addChunk(plugin.opts.manifest);
		_.each(compilation.entrypoints, (entrypoint, name) => {
			entrypoint.insertChunk(manifestChunk, entrypoint.chunks[0]);
			manifestChunk.addChunk(entrypoint.chunks[1]);
			entrypoint.chunks[1].addParent(manifestChunk);
		});
	}

	function onEachChunk(bundleInitialChunkMap, bundleAsyncChunkMap, m, bundle, divededChunkSet, chunk, isInitialChunk) {
		var newChunk;
		if (isInitialChunk && _.has(bundleInitialChunkMap, bundle)) {
			newChunk = bundleInitialChunkMap[bundle];
			divideLog.debug('\t\texisting chunk [%s]', getChunkName(newChunk));
		} else if (!isInitialChunk && _.has(bundleAsyncChunkMap, bundle)) {
			newChunk = bundleAsyncChunkMap[bundle];
			divideLog.debug('\t\texisting chunk [%s]', getChunkName(newChunk));
		} else {
			newChunk = this.addChunk(bundle);
			divideLog.debug('\t\tcreate %s chunk [%s] %s', isInitialChunk ? 'initial' : 'async', bundle, getChunkName(newChunk));
			if (isInitialChunk)
				bundleInitialChunkMap[bundle] = newChunk;
			else
				bundleAsyncChunkMap[bundle] = newChunk;
		}
		// move module
		chunk.moveModule(m, newChunk);
		divideLog.debug('\t\tmove module "%s" from chunk [%s] to [%s]', simpleModuleId(m), getChunkName(chunk), getChunkName(newChunk));
		// m.removeChunk(chunk);
		// var added = newChunk.addModule(m);
		// if (added) {
		// 	m.addChunk(newChunk);
		// 	divideLog.debug('\t\tmove module "%s" from chunk [%s] to [%s]', simpleModuleId(m), getChunkName(chunk), getChunkName(newChunk));
		// } else {
		// 	divideLog.debug('\t\tremove module "%s" from chunk [%s]', simpleModuleId(m), getChunkName(chunk));
		// }
		if (_.has(divededChunkSet, newChunk.debugId))
			return;
		divideLog.debug('\t\tchunk [%s] is splitted', getChunkName(chunk));
		divededChunkSet[newChunk.debugId] = 1;

		if (isInitialChunk) {
			newChunk.addChunk(chunk);
			if (chunk.parents && chunk.parents.length > 0)
				chunk.parents.forEach(p => {
					p.removeChunk(chunk);
					p.addChunk(newChunk);
					newChunk.addParent(p);
				});
			chunk.parents = [newChunk];
			_.each(chunk.entrypoints, (entrypoint) => {
				var existing = entrypoint.chunks.indexOf(newChunk);
				if (existing >= 0)
					entrypoint.chunks.splice(existing, 1);
				entrypoint.insertChunk(newChunk, chunk);
			});
		} else {
			// require.ensure() loaded chunk
			//_.each(chunk.blocks, block => );
			chunk.parents.forEach(p => {
				newChunk.addParent(p);
				p.addChunk(newChunk);
			});
			_.each(chunk.blocks, block => {
				newChunk.addBlock(block);
				if (block.chunks.indexOf(newChunk) < 0)
					block.chunks.push(newChunk);
			});
		}
	}

	function removeEmptyChunk(compilation) {
		_.remove(compilation.chunks, chunk => {
			if (chunk.isEmpty() && !chunk.hasRuntime()) {
				log.info('Empty chunk %s', getChunkName(chunk));
				chunk.remove('empty');
				compilation.chunks.splice(compilation.chunks.indexOf(chunk), 1);
				if (chunk.name)
					delete compilation.namedChunks[chunk.name];
				return true;
			}
			return false;
		});
	}

	function simpleModuleId(m) {
		return Path.relative(compiler.options.context, (m.identifier() || m.name).split('!').slice().pop());
	}

	function printChunks(compilation, chunks) {
		chunks.forEach(function(chunk) {
			log.debug('chunk: %s, parents:(%s), isInitial: %s, ids: %s',
				getChunkName(chunk),
				chunk.parents.map(p => getChunkName(p)).join(', '), chunk.isInitial(), chunk.ids);
			log.debug('\tchildren: (%s)', chunk.chunks.map(ck => getChunkName(ck)).join(', '));
			log.debug('\t%s %s', chunk.hasRuntime() ? '(has runtime)' : '', chunk.hasEntryModule() ? `(has entryModule: ${simpleModuleId(chunk.entryModule)})` : '');

			log.debug('  ├─ modules');
			chunk.modules.forEach(function(module) {
				// Explore each source file path that was included into the module:
				log.debug('  │  ├─ %s', simpleModuleId(module));
				if (showFileDep)
					_.each(module.fileDependencies, filepath => {
						logFd.debug('  │  │  ├─ %s', chalk.blue('(fileDependency): ' + Path.relative(compiler.options.context, filepath)));
					});
				_.each(module.blocks, block => {
					log.debug('  │  │  ├─ (block %s): %s', block.constructor.name,
						_.map(block.chunks, ck => {
							return getChunkName(ck);
						}).join(', '));
					if (showDependency) {
						_.each(block.dependencies, bDep => {
							logD.debug(`  │  │  │  ├─ ${bDep.constructor.name}`);
							if (bDep.module)
								logD.debug(`  │  │  │  │  ├─ .module ${simpleModuleId(bDep.module)}`);
						});
					}
				});
				if (showDependency) {
					_.each(module.dependencies, dep => {
						var source = module._source.source();
						logD.debug('  │  │  ├─ %s', chalk.blue('(dependency %s): ' + dep.constructor.name),
							dep.range ? source.substring(dep.range[0], dep.range[1]) : '');
						if (dep.module)
							logD.debug(`  │  │  │  ├─ .module ${chalk.blue(simpleModuleId(dep.module))}`);
					});
				}
			});
			log.debug('  │  ');

			// Explore each asset filename generated by the chunk:
			chunk.files.forEach(function(filename) {
				log.debug('  ├── file: %s', filename);
				// Get the asset source for each file generated by the chunk:
				//var source = compilation.assets[filename].source();
			});
		});
		printChunksByEntry(compilation);
	}

	function getChunkName(chunk) {
		var id = chunk.debugId;
		if (chunk.id)
			id = chunk.id + '-' + chunk.debugId;
		return '#' + id + ' ' + chalk.green(chunk.name || '');
	}

	function printChunksByEntry(compilation) {
		_.each(compilation.entrypoints, (entrypoint, name) => {
			log.info('entrypoint %s', chalk.green(name));
			_.each(entrypoint.chunks, chunk => log.info('\t%s', chunk.files[0]));
		});
	}
};

