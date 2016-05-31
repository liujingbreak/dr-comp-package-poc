var buildUtils = require('../lib/gulp/buildUtils');
var log = require('log4js').getLogger('buildUtilsSpec');

describe('buildUtils', () => {
	it('getNpmVersion() should return proper version string', (done)=> {
		buildUtils.getNpmVersion().then(ver => {
			log.debug('"'+ ver + '"');
			var major = /^([0-9]+)\./.exec(ver)[1];
			log.debug(major);
			expect(parseInt(major, 10)).toBeGreaterThan(1);
			done();
		})
		.catch(e => {
			done.fail(e);
		});
	});
});
