
module.exports = {
	TimelineLite: require('./src/uncompressed/TimelineLite'),
	TweenMax: require('./src/uncompressed/TweenMax')
};
// TweenMax includes TweenLite, CSSPlugin, EasePack, TimelineLite, TimelineMax,
//  RoundPropsPlugin, BezierPlugin, AttrPlugin, and DirectionalRotationPlugin
require('./src/uncompressed/plugins/TextPlugin');
require('./src/uncompressed/plugins/ScrollToPlugin');
