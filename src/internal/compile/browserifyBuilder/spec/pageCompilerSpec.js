var PageCompiler = require('../lib/pageCompiler');
var through = require('through2');
//var _ = require('lodash');

describe('PageCompiler', function() {
	it('.transform() should work with 1 addonTransform1', function() {
		var sample = new PageCompiler([createAddonTransform, createAddonTransform2]);
		var content = sample.transform('test.html', '<h1>hellow world</h1>');
		expect(content).toEqual('<h1>hellow world</h1>.changed.changed2');
	});

	it('.transform() should work with 2 addonTransforms', function() {
		var sample = new PageCompiler([createAddonTransform]);
		var content = sample.transform('test.html', '<h1>hellow world</h1>');
		expect(content).toEqual('<h1>hellow world</h1>.changed');
	});

	it('.transform() should work when there is no addonTransforms', function() {
		var sample = new PageCompiler([]);
		var content = sample.transform('test.html', '<h1>hellow world</h1>');
		expect(content).toEqual('<h1>hellow world</h1>');
	});

	function createAddonTransform() {
		var str = '';
		return through(function(chunk, enc, next) {
			str += chunk.toString();
			next();
		}, function(next) {
			this.push(str + '.changed');
			next();
		}).setEncoding('utf8');
	}

	function createAddonTransform2() {
		var str = '';
		return through(function(chunk, enc, next) {
			str += chunk.toString();
			next();
		}, function(next) {
			this.push(str + '.changed2');
			next();
		}).setEncoding('utf8');
	}
});
