var log = require('log4js').getLogger('ManualChunkPlugin');
var _ = require('lodash');
var Path = require('path');
var api = require('__api');
var getChunkOfPackage = require('./lib/setup').getChunkOfPackage;
var nextIdent = 0;

function ManualChunkPlugin(opts) {
	this.ident = __filename + (nextIdent++);
	this.opts = opts;
	if (!opts.manifest)
		opts.manifest = 'manifest';
}

module.exports = ManualChunkPlugin;

ManualChunkPlugin.prototype.apply = function(compiler) {
	var plugin = this;
	var ident = this.ident;
	var bundleChunkMap = {}; // a hash map, key: bundle name, value: chunk instance

	compiler.plugin('this-compilation', function(compilation) {
		compilation.plugin(['optimize'], function() {
			log.debug('-------------- optimize -------------------');
		});
		compilation.plugin(['optimize-chunks', 'optimize-extracted-chunks'], function(chunks) {
			// only optimize once
			if (compilation[ident])
				return;
			compilation[ident] = true;
			log.debug('optimize: %s', chunks.map(c => c.name).join(', '));
			printChunks(compilation, chunks);

			divideModule.call(compilation, chunks);
		});
	});

	compiler.plugin('emit', function(compilation, callback) {
		log.debug('------------- emit ------------------');
		printChunks(compilation, compilation.chunks);
		//compilation.assets['testentry/test.html'] = new wps.CachedSource(new wps.RawSource('fffhfhfhfh'));
		callback();
	});

	function divideModule(chunks) {
		log.debug(_.repeat('-', 10) + ' divide module ' + _.repeat('-', 10));
		chunks = chunks.slice();
		// create initial manifest chunk
		var self = this;

		var divededChunkMap = {};
		chunks.forEach(chunk => {
			var divededChunkSet = divededChunkMap[chunk.debugId] = {};
			var isInitialChunk = chunk.isInitial();
			// if (!isInitialChunk)
			// 	return;
			_.each(chunk.modules.slice(), (module, idx) => {
				var file = module.fileDependencies[0];
				if (!file)
					return;
				var package = api.findPackageByFile(file);
				if (!package)
					return;

				var bundle = getChunkOfPackage(package);
				if (chunk.name == null) {
					chunk.name = bundle;
					return;
				}
				if (bundle === chunk.name) {
					bundleChunkMap[bundle] = chunk;
					return;
				}
				var newChunk;
				if (_.has(bundleChunkMap, bundle))
					newChunk = bundleChunkMap[bundle];
				else {
					newChunk = self.addChunk(bundle);
					log.debug('create %s chunk %s #%s', isInitialChunk ? 'initial' : 'async', bundle, newChunk.debugId);
					bundleChunkMap[bundle] = newChunk;
				}
				// move module
				module.removeChunk(chunk);
				module.addChunk(newChunk);
				newChunk.addModule(module);
				log.debug('move module %s from chunk #%s -> #%s', simpleModuleId(module), chunk.debugId, newChunk.debugId);

				if (_.has(divededChunkSet, newChunk.debugId))
					return;
				log.debug('chunk #%s is splitted', chunk.debugId);
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
			});
		});

		var manifestChunk = self.addChunk(plugin.opts.manifest);
		_.each(self.entrypoints, (entrypoint, name) => {
			log.debug('entrypoint %s', name);
			entrypoint.insertChunk(manifestChunk, entrypoint.chunks[0]);
			manifestChunk.addChunk(entrypoint.chunks[1]);
			entrypoint.chunks[1].addParent(manifestChunk);
		});
	}

	function simpleModuleId(module) {
		return Path.relative(compiler.options.context, (module.identifier() || module.name).split('!').slice().pop());
	}

	function printChunks(compilation, chunks) {
		chunks.forEach(function(chunk) {
			log.debug('chunk: #%s, "%s", parents:(%s), isInitial: %s, ids: %s',
				chunk.id != null ? chunk.id : chunk.debugId, chunk.name,
				chunk.parents.map(p => '#' + (p.id != null ? p.id : p.debugId)).join(', '), chunk.isInitial(), chunk.ids);
			log.debug('\tchildren: (%s)', chunk.chunks.map(ck => '#' + (ck.id != null ? ck.id : ck.debugId)).join(', '));
			log.debug('\t%s %s', chunk.hasRuntime() ? '(has runtime)' : '', chunk.hasEntryModule() ? `(has entryModule: ${simpleModuleId(chunk.entryModule)})` : '');

			log.debug('  ├─ modules');
			chunk.modules.forEach(function(module) {
				// Explore each source file path that was included into the module:
				log.debug('  │  ├─ #%s', module.id);
				_.each(module.fileDependencies, filepath => {
					log.debug('  │  │  ├─ (fileDependency): %s', Path.relative(compiler.options.context, filepath));
				});
				_.each(module.blocks, block => {
					log.debug('  │  │  ├─ (block %s): %s', block.constructor.name,
						block.chunks.map( ck => {
							return '#' + (ck.id != null ? ck.id : ck.debugId);
						}).join(', '));
					_.each(block.dependencies, bDep => {
						log.debug(`  │  │  │  ├─ ${bDep.constructor.name}`);
						if (bDep.module)
							log.debug(`  │  │  │  │  ├─ .module ${simpleModuleId(bDep.module)}`);
					});
				});
				_.each(module.dependencies, dep => {
					var source = module._source.source();
					log.debug('  │  │  ├─ (dependency %s): %s', dep.constructor.name,
						source.substring(dep.range[0], dep.range[1]));
					if (dep.module)
						log.debug(`  │  │  │  ├─ .module ${simpleModuleId(dep.module)}`);
				});
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

	function printChunksByEntry(compilation) {
		_.each(compilation.entrypoints, (entrypoint, name) => {
			log.debug('entrypoint %s', name);
			_.each(entrypoint.chunks, chunk => log.debug('\t%s', chunk.files[0]));
		});
	}
};
