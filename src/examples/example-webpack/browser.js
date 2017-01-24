console.log('In browser.js %s', __filename);
//require('__api');
console.log(require('./test-html.html'));
//require('@dr/example-common');
// console.log(require('./test-json.json'));
// console.log(require('./test-text.txt'));
// console.log(require('./test.yaml'));

require.ensure([], function(require) {
	require('@dr/example-common');
	require('./test-html.html');
	require('./test.yaml');
});
