var packageUtils = require('../lib/packageMgr/packageUtils');
var log = require('log4js').getLogger(__filename);

describe('packageUtils', function() {
	describe('.findAllPackages()', function() {
		it('should return proper number of packages with parameter "packages"', function() {
			var callback = jasmine.createSpy('found');
			packageUtils.findAllPackages(['browserify-builder', 'labjs'], callback, 'src');
			expect(callback.calls.count()).toEqual(2);
		});
		it('should return proper number of packages without parameter "packages"', function() {
			var callback = jasmine.createSpy('found');
			packageUtils.findAllPackages(callback, 'src');
			log.debug(callback.calls.allArgs().map(row => { return row[0];}));
			expect(callback.calls.count()).toBeGreaterThan(10);
		});
		it('should return proper number of packages when parameter "packages" is null', function() {
			var callback = jasmine.createSpy('found');
			packageUtils.findAllPackages(null, callback, 'src');
			expect(callback.calls.count()).toBeGreaterThan(10);
		});
		it('should return proper number of packages with only parameter "callback"', function() {
			var callback = jasmine.createSpy('found');
			packageUtils.findAllPackages(callback);
			expect(callback.calls.count()).toBeGreaterThan(10);
		});
	});

	it('.lookForPackages() should work for fullname or patial name', function() {
		var callback = jasmine.createSpy('found');
		packageUtils.lookForPackages(['browserify-builder', 'labjs'], callback);
		expect(callback.calls.count()).toEqual(2);
		expect(callback).toHaveBeenCalledWith('@dr-core/browserify-builder',
			jasmine.any(String), jasmine.any(Object), jasmine.any(Object), jasmine.any(String));
		expect(callback).toHaveBeenCalledWith('@dr-core/labjs',
				jasmine.any(String), jasmine.any(Object), jasmine.any(Object), jasmine.any(String));
	});
});
