require.ensure(['a', 'b'], function(require) {
});

global.require.ensure(['c', 'd'], function(require) {
});

require.
ensure
	(['e',
	'f'], function(require) {
});

require.ensure('g', function(){});
