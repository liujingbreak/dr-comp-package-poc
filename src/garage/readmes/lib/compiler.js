var gulp = require('gulp');
var Markdown = require('markdown-it');
var hljs = require('highlight.js');
var through = require('through2');
var Path = require('path');
var fs = require('fs');
var _ = require('lodash');
var log = require('log4js').getLogger('readmes.compiler');
var cheerio = require('cheerio');
module.exports = compile;

function compile(packageUtils, config, argv) {
	if (argv.b && argv.b !== 'readmes') {
		log.info('skip readme compilation');
		return;
	}

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
	return gulp.src(__dirname + '/../doc/**/*.*')
		.pipe(through.obj(function(row, enc, next) {
			if (!_.endsWith(row.path, '.md')) {
				return next(null, row);
			}
			var targetFile = Path.resolve(config().destDir, 'static/readmes', Path.relative(row.base, row.path));
			log.debug(targetFile);
			var dot = targetFile.lastIndexOf('.');
			targetFile = targetFile.substring(0, dot) + '.html';
			log.debug('check ' + targetFile);
			if (fs.existsSync(targetFile) && fs.statSync(targetFile).mtime.getTime() >=
				fs.statSync(row.path).mtime.getTime()) {
				return;
			}
			log.debug('compile ' + row.path);
			var html = mk.render(row.contents.toString());
			var $ = cheerio.load(html);
			replaceImages($, config);
			replaceAnchors($, config);
			row.contents = new Buffer($.html());
			dot = row.path.lastIndexOf('.');
			row.path = row.path.substring(0, dot) + '.html';
			this.push(row);
			next();
		}))
		.pipe(gulp.dest(config().destDir + '/static/readmes'))
		.on('error', function(err) {
			log.error(err);
			throw new Error(err.stack);
		});
}

function replaceImages($, config) {
	$('img').each(function(index) {
		var el = $(this);
		var src = el.attr('src');
		if (!_.startsWith(src, '/')) {
			el.attr('src', config().staticAssetsURL + '/readmes/cn/' + src);
		}
	});
}

function replaceAnchors($, config) {
	$('a').each(function(index) {
		var el = $(this);
		var src = el.attr('href');
		if (!_.startsWith(src, '/') && !_.startsWith(src, 'http://')) {
			if (_.endsWith(src, '.md')) {
				src = src.substring(0, src.length - 3);
			}
			el.attr('href', '#/doc/' + src);
		}
	});
}
