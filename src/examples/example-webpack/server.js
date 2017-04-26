var api = require('__api');
var log = require('log4js').getLogger(api.packageName);

exports.onCompileTemplate = function(filePath, swig) {
	log.info('swig compiling %s', filePath);
	return {locals: {testSwig: 'Hey from Swig-tempalte', path: filePath}};
};
