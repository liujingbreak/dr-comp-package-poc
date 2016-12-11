var through = require('through2');
var Path = require('path');
var api = require('__api');
var stream = require('stream');
var log = require('@dr/logger').getLogger(api.packageName + '.browserifyHelper');
var fs = require('fs');
var esParser = require('./esParser');
var _ = require('lodash');

var config, injector;

module.exports = function(_config, _injector) {
	config = _config;
	injector = _injector;
	var buildins = ['assert', 'buffer', 'child_process', 'cluster', 'console', 'constants', 'crypto', 'dgram', 'dns',
	'domain', 'events', 'fs', 'http', 'https', 'module', 'net', 'os', 'path', 'punycode', 'querystring',
	'readline', 'repl', 'stream', '_stream_duplex', '_stream_passthrough', '_stream_readable',
	'_stream_transform', '_stream_writable', 'string_decoder', 'sys', 'timers', 'tls', 'tty', 'url',
	'util', 'vm', 'zlib', '_process'];

	var buildinSet = {};
	buildins.forEach(function(name) {
		buildinSet[name] = true;
	});
	return {
		JsBundleEntryMaker: JsBundleEntryMaker,
		//JsBundleWithI18nMaker: JsBundleWithI18nMaker,
		buildins: buildins,
		buildinSet: buildinSet,
		str2Stream: str2Stream
	};
};
//exports.dependencyTree = dependencyTree;

var BOOT_FUNCTION_PREFIX = '_deps_';
var apiVariableTpl = _.template(fs.readFileSync(
	Path.join(__dirname, 'templates', 'apiVariable.js.tmpl'), 'utf8'));

function JsBundleEntryMaker(api, bundleName, packageBrowserInstances,
	fileSplitPointMap) {
	if (!(this instanceof JsBundleEntryMaker)) {
		return new JsBundleEntryMaker(api, bundleName, packageBrowserInstances,
			fileSplitPointMap);
	}
	this.api = api; // same as require('__api');
	this.packages = packageBrowserInstances;
	this.bundleName = bundleName;
	this.bundleFileName = bundleName + '_bundle_entry.js';
	this.activeModules = {}; //key: bundle name, value: array of active module name

	this.fileSplitPointMap = fileSplitPointMap;
	this.CDNDependUrlSet = {}; // external JS library URL
}

//var apiVarablePat = /(?:^|[^\w$\.])__api(?:$|[^\w$])/mg;

JsBundleEntryMaker.prototype = {
	entryBundleFileTpl:
	_.template(fs.readFileSync(Path.join(__dirname, 'templates', 'bundle.js.tmpl'), 'utf8'), {imports: {api: api, _: _}}),
	setLocale: function(locale) {
		this.locale = locale;
	},

	createPackageListFile: function() {
		var bundleFileListFunction = this.entryBundleFileTpl({
			bundle: this.bundleName,
			requireFilesFuncName: BOOT_FUNCTION_PREFIX + safeBundleNameOf(this.bundleName),
			packageInstances: this.packages
		});
		return bundleFileListFunction;
	},

	transform: function(locale) {
		var self = this;
		return function(file) {
			var source = '';
			var ext = Path.extname(file).toLowerCase();
			var basename = Path.basename(file);
			if (ext === '.js' && basename !== self.bundleFileName) {
				return through(function(chunk, enc, next) {
					source += chunk;
					next();
				}, function(cb) {
					try {
						this.push(self.transformJS(source, file, locale));
					} catch (e) {
						this.emit('error', e);
					}
					cb();
				});
			} else if (ext === '.html'){
				return through(function(chunk, enc, next) {
					source += chunk;
					next();
				}, function(cb) {
					try {
						source = api.replaceAssetsUrl(source, file);
						this.push(source);
					} catch (e) {
						this.emit('error', e);
					}
					cb();
				});
			} else {
				return through();
			}
		};
	},

	transformJS: function(source, file, locale) {
		var currPackageName;
		var hasRequireEnsure = false;
		var self = this;
		var hasApi = false;

		var relRealPath = Path.relative(api.config().rootPath, fs.realpathSync(file));
		delete self.fileSplitPointMap[relRealPath]; // clean up cached data

		// apiVarablePat.lastIndex = 0;
		// if (apiVarablePat.test(source)) {
		// 	log.debug('reference __api in ' + file);
		// 	currPackageName = this.api.findBrowserPackageByPath(file);
		// 	source = apiVariableTpl({
		// 		bundle: this.bundleName,
		// 		packageName: currPackageName,
		// 		source: source,
		// 		packageNameAvailable: currPackageName !== null
		// 	});
		// }
		var ast;
		try {
			ast = esParser.parse(source, {
				splitLoad: splitPoint => {
					hasRequireEnsure = true;
					if (!_.has(self.fileSplitPointMap, relRealPath)) {
						self.fileSplitPointMap[relRealPath] = {};
					}
					self.fileSplitPointMap[relRealPath][splitPoint] = 1;
				},

				apiIndentity: () => {hasApi = true;}
			});
		} catch (e) {
			log.error('Failed to parse %s', file);
			throw e;
		}
		function onReplaceApiCall(mName) {
			if (mName === '__api') {
				hasApi = true;
				log.debug('require __api in ' + file);
			}
		}
		injector.on('replace', onReplaceApiCall);
		source = injector.injectToFile(file, source, ast);
		injector.removeListener('replace', onReplaceApiCall);
		if (hasRequireEnsure) {
			source = 'require.ensure = function(){return drApi.ensureRequire.apply(drApi, arguments)};\n' +
				source;
		}

		if (hasApi) {
			log.debug('reference __api in ' + file);
			currPackageName = this.api.findBrowserPackageByPath(file);
			source = apiVariableTpl({
				bundle: this.bundleName,
				packageName: currPackageName,
				source: source,
				packageNameAvailable: currPackageName !== null
			});
		}
		return source;
	},

	createPackageListFileStream: function(bundleName, packageInstances) {
		return str2Stream(this.createPackageListFile.apply(this, arguments));
	}
};

function safeBundleNameOf(bundleName) {
	return bundleName.replace(/[-\.&#@]/g, '_');
}

function str2Stream(str) {
	var output = new stream.Readable();
	output._read = function() {};
	output.push(str);
	output.push(null);
	return output;
}

