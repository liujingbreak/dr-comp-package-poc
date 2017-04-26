console.log('Damn example-webpack: %s', __filename);
console.log(require('__api').packageName);
console.log(require('./test-html.html'));
require('@dr/example-webpack2');
//require('@dr/example-webpack-dependency');
require('./main.less');
//require('@dr/example-common');
// console.log(require('./test-json.json'));
// console.log(require('./test-text.txt'));
// console.log(require('./test.yaml'));
setTimeout(function() {
	require.ensure([], function(require) {
		require('@dr/example-common');
		console.log('require.ensure block ends');
	});
}, 2000);
console.log('file-load: %s', require('./files/default.png'));

//require('!@dr-core/webpack2-builder/lib/entry-html-loader!./files/test-md.md');

console.log('test markdown URL: %s',
require('!lib/dr-file-loader?name=[path][name].[md5:hash:hex:8].html!lib/html-loader!lib/markdown-loader!./files/test-md.md'));

console.log(require('./test-jade.jade'));
document.getElementById('test-markdown').innerHTML = require('./files/test-md.md');
