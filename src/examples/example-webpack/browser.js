console.log('In browser.js %s', __filename);
//require('lodash');
console.log(require('./test-html.html'));
console.log(require('./test-json.json'));
console.log(require('./test-text.txt'));
console.log(require('./test.yaml'));

require.ensure(['@dr/example-webpack-dependency', 'lodash'], function(require) {
	require('@dr/example-webpack-dependency');
	//require('lodash');
});
