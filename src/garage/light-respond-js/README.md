
## Responsive screen width resize detection and top level CSS class name
This package is a super light function that detects screen size and whether it supports touch event, and puts special CSS class names like `size-desktop`, `size-tablet`, `size-mobile` onto HTML element.

Also Modernizr is used in this package to detect Touch events feature.
```css
CSS
.no-touchevents .box { color: red; }
.touchevents .box { color: green; }
```
```javascript
JS
if (Modernizr.touchevents) {
  // supported
} else {
  // not-supported
}
```

## Visibility class name
You can control visibility by add/remove class name of specific element with
`size-mobile-hide`, `size-tablet-hide`, `size-desktop-hide`, and `size-mobile-only`, `size-tablet-only`, `size-desktop-only`, because
according to different screen width, style
`display: none` is preset for following selectors:

```less
.size-mobile {
	.size-mobile-hide, .size-desktop-only, .size-tablet-only {
		display: none;
	}
}

.size-tablet {
	.size-tablet-hide, .size-desktop-only, .size-mobile-hide {
		display: none;
	}
}

.size-desktop {
	.size-desktop-hide, .size-mobile-only, .size-tablet-only {
		display: none;
	}
}
```


Copied idea from

[Firing Responsive jQuery Functions based on CSS Media Queries Rather than Window Width](https://www.fourfront.us/blog/jquery-window-width-and-media-queries)

> There are some great options for managing Javascript when using CSS media queries in a responsive website. MediaCheck, jRespond, and Breakpoints.js all allow you to fire javascript functions based on customizable breakpoints in browser width. However, recently I was working on a small site with only a single function to be called at a smaller browser size, in conjunction with a media query, and thought I'd forgo one of these scripts and manage my change using a jQuery window width measurement.
...

> The Problem: jQuery $(window).width() and CSS3 Media Queries do not always match.

> The solution: use jQuery to test for a changed CSS property, rather than the browser width

```javascript
$(document).ready(function() {
    // run test on initial page load
    checkSize();

    // run test on resize of the window
    $(window).resize(checkSize);
});

//Function to the css rule
function checkSize(){
    if ($(".sampleClass").css("float") == "none" ){
        // your code here
    }
}
```

```css
.sampleClass {float:left;}
@media only screen and (max-width: 800px){
	.sampleClass {float:none;}
}
```
