console.log('example-webpack: %s', __filename);
//require('__api');
console.log(require('./test-html.html'));
require('@dr/example-webpack2');
require('lodash');
//require('@dr/example-common');
// console.log(require('./test-json.json'));
// console.log(require('./test-text.txt'));
// console.log(require('./test.yaml'));

require.ensure([], function(require) {
	require('@dr/example-common');
	require('@dr/example-webpack-dependency');
	console.log('require.ensure block ends');
});
