var priorityHelper = require('../lib/packageMgr/packagePriorityHelper');
var _ = require('lodash');

describe('packagePriorityHelper', function() {
	it('should work 1', function(done) {
		var packages = [
			{
				longName: 'A',
				priority: 'after B'
			},
			{
				longName: 'B',
				priority: 'before D'
			},
			{
				longName: 'C',
				priority: 'before D'
			},
			{
				longName: 'D',
				priority: 6000
			},
			{
				longName: 'E'
			}
		];
		var run = jasmine.createSpy('run');
		priorityHelper.orderPackages(packages, run)
		.then(() => {
			expect(run.calls.count()).toEqual(5);
			// _.times(5, (i) => {
			// 	console.log(run.calls.argsFor(i));
			// });
			expect(run.calls.argsFor(0)[0].longName).toEqual('E');
			expect(run.calls.argsFor(3)[0].longName).toEqual('A');
			expect(run.calls.argsFor(4)[0].longName).toEqual('D');
			done();
		});
	});

	it('should work 2', function(done) {
		var packages = [
			{
				longName: 'A'
			},
			{
				longName: 'B',
				priority: 'before A'
			},
			{
				longName: 'C',
				priority: 'before B'
			},
			{
				longName: 'D',
				priority: 'after B'
			},
			{
				longName: 'E',
				priority: 5001
			}
		];
		var run = jasmine.createSpy('run');
		priorityHelper.orderPackages(packages, run)
		.then(() => {
			expect(run.calls.count()).toEqual(5);
			_.times(5, (i) => {
				console.log(run.calls.argsFor(i));
			});
			expect(run.calls.argsFor(0)[0].longName).toEqual('C');
			expect(run.calls.argsFor(1)[0].longName).toEqual('B');
			expect(run.calls.argsFor(2)[0].longName).toEqual('D');
			expect(run.calls.argsFor(3)[0].longName).toEqual('A');
			expect(run.calls.argsFor(4)[0].longName).toEqual('E');
			done();
		});
	});
});
