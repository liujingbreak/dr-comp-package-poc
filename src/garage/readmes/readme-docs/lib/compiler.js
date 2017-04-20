var gulp = require('gulp');
var Markdown = require('markdown-it');
var hljs = require('highlight.js');
var through = require('through2');
var Path = require('path');
var fs = require('fs');
var _ = require('lodash');
var log = require('log4js').getLogger('readmes.compiler');
var cheerio = require('cheerio');
var RevAll = require('gulp-rev-all');
var Promise = require('bluebird');
var File = require('vinyl');
var buildUtils = require('__api').buildUtils;

module.exports = compile;

var packageUtils, config;
var distDir = 'readme-docs';
var srcDir = Path.resolve(__dirname, '..', 'doc');
var readmeMappingFileName = 'readmeMapping.js';
var docPath = Path.resolve(__dirname, '..', 'doc');

var mk = new Markdown({
	html: true,
	highlight: function(str, lang) {
		if (lang && hljs.getLanguage(lang)) {
			try {
				return hljs.highlight(lang, str, true).value;
			} catch (__) {}
		}
		return ''; // use external default escaping
	}
});

function compile(_packageUtils, _config, argv) {
	if (argv.p && argv.p !== 'readme-docs') {
		log.info('skip readme compilation');
		return;
	}

	packageUtils = _packageUtils;
	config = _config;
	var revAll = new RevAll({
		fileNameManifest: 'readmes-rev-manifest.json',
		dontRenameFile: [readmeMappingFileName],
		debug: config().devMode
	});
	var readmePackagePath = packageUtils.findBrowserPackagePath('@dr/readme');

	return gulp.src([docPath.replace(/\\/g, '/') + '/**/*.*'], {base: srcDir})
		.pipe(compileMarkdown())
		.pipe(revAll.revision())
		.pipe(replaceReference())
		.pipe(through.obj(function(file, enc, next) {
			var ext = Path.extname(file.path);
			if (ext === '.md') {
				file.path = file.path.substring(0, file.path.lastIndexOf('.')) + '.html';
				log.debug('rename to html: ' + file.path);
			}
			next(null, file);
		}))
		.pipe(gulp.dest(config().staticDir + '/' + distDir))
		.pipe(revAll.manifestFile())
		.pipe(mergeWithExistingMani(readmePackagePath))
		.pipe(gulp.dest(config().destDir))
		.pipe(removeUselessManifestData())
		.pipe(gulp.dest(readmePackagePath + '/dist'))
		.on('end', function() {
			buildUtils.writeTimestamp('readme');
		})
		.on('error', function(err) {
			log.error(err);
			throw new Error(err.stack);
		});
}

var readFileAsync = Promise.promisify(fs.readFile, {context: fs});

function mergeWithExistingMani(readmePackagePath) {
	return through.obj(function(row, encode, next) {
		var file = Path.join(readmePackagePath, 'dist', Path.basename(row.path));
		if (fs.existsSync(file)) {
			readFileAsync(file).then(function(data) {
				var meta = JSON.parse(row.contents.toString('utf8'));
				log.debug(meta);
				var newMeta = JSON.stringify(_.assign(JSON.parse(data), meta), null, '\t');
				log.debug('merge with existing manifest');
				row.contents = new Buffer(newMeta);
				next(null, row);
			});
		} else {
			next(null, row);
		}
	});
}

function removeUselessManifestData() {
	return through.obj(function(row, encode, next) {
		var manifest = row.contents.toString('utf8');
		var json = JSON.parse(manifest);
		_.forOwn(json, function(value, key) {
			if (!_.endsWith(key, '.md')) {
				delete json[key];
			}
		});
		row.contents = new Buffer(JSON.stringify(json, null, '\t'));
		next(null, row);
	});
}

function compileMarkdown() {
	var count = 0;
	return through.obj(function(row, enc, next) {
		if (buildUtils.readTimestamp('readme') && buildUtils.readTimestamp('readme') >=
			fs.statSync(row.path).mtime.getTime()) {
			return next();
		}
		count++;
		if (!_.endsWith(row.path, '.md')) {
			return next(null, row);
		}
		log.debug('compile ' + row.path);
		var html = mk.render(row.contents.toString());
		row.contents = new Buffer(html);
		this.push(row);
		next();
	}, function(next) {
		if (count === 0) {
			log.debug('no files changed');
			// gulp-rev-all require at lease 1 file in stream
			this.push(new File({
				path: Path.resolve(srcDir, '_placeholder.txt'),
				contents: new Buffer('')
			}));
		}
		next();
	});
}

function replaceReference() {
	return through.obj(function(row, enc, next) {
		if (!_.endsWith(row.path, '.md')) {
			return next(null, row);
		}
		var filePath = Path.relative(Path.resolve(docPath), row.path);
		var $ = cheerio.load(row.contents.toString());
		replaceImages(filePath, $, config);
		replaceAnchors($, config);
		row.contents = new Buffer($.html());
		this.push(row);
		next();
	});
}

function replaceImages(filePath, $, config) {
	var dir = Path.dirname(filePath);
	if (dir) {
		dir += '/';
	}
	$('img').each(function(index) {
		var el = $(this);
		var src = el.attr('src');
		if (!_.startsWith(src, '/')) {
			var dest = config().staticAssetsURL + '/' + distDir + '/' + dir + src;
			el.attr('src', dest);
			log.debug(src + ' -> ' + dest);
		}
	});
}

function replaceAnchors($, config) {
	$('a').each(function(index) {
		var el = $(this);
		var src = el.attr('href');
		var dest;
		if (!_.startsWith(src, '/') && !_.startsWith(src, 'http') && _.endsWith(src, '.md')) {
			src = src.replace(/\.[^.]+\.md$/g, '.md');
			dest = '#/doc/' + src;
			el.attr('href', dest);
			log.debug(src + ' -> ' + dest);
		}
	});
}
