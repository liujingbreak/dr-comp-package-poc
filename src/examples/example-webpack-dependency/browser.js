console.log('In browser.js %s', __filename);
require.ensure([], function(require) {
	require('@dr/example-common');
});
// exports.foobar = require('./test-html.html');
// require('./test-json.json');
// require('./test-text.txt');

