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
