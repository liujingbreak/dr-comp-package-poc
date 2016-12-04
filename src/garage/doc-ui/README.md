Doc UI components
==========
Non-angularJS spin loading indicator.
-------------
Following HTML fragment should be pasted to entry html file,
it shows spinning icon at very beiginning of loading process
even before AngularJS has not started.
```html
<dr-doc-spinner class="spin-loading" ng-show="">
	<div class="spinning" aria-hidden="true"></div>
</dr-doc-spinner>
```

LESS components
-------------
### Variables and mixins

Put it at beginning of you LESS files.
```css
@import "npm://@dr/doc-ui/browser/less/dr-variables.less";
@import "npm://@dr/doc-ui/browser/less/dr-mixins.less";
```
