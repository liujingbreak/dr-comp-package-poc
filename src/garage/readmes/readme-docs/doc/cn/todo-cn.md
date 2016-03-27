Backlog
=======

每个人都是产品经理, 每个feature都是package

### The platform

-	i18n text translation tool\\ Scan and generate translatable property files.
-	Provide API to get locale information
-	Test script\\ Jasmine 2

-	Adaptive/Responsive layouts API/utility

	-	Detecting device and screen size/orientation change by Javascript, adding class name to root level element\\ e.g. `dr-device-mouse`, `dr-device-touch`, `dr-desktop`, `dr-tablet`, `dr-mobile`, `dr-engine-gecko`, ...

-	Assets file revision (@dr/assets-processer)

-	Split and load on demand in browser (Support angular JS lazy loader)

-	Mobile browser super light and fast entry bundle

-	CDN assets pack

-	security consideration

	-	CORS
	-	CSRF
	-	Clickjacking
	-	Content Security Policy
	-	DDOS
	-	P3P
	-	Socket Hijacking
	-	XSS
	-	Strict Transport Security

-	Run node package in `vm` sandbox, inject API object into local variable scope of each node js file.

-	Gulp watch script enhance (detect new/delete package, watch node package)

-	Support SCSS ?

-	Package readme file viewer

-	ECMAScript 6 builder with Babel

### Sinopia NPM registry server

-	Check Uploading package size limitation
-	Email notification for package publishing.

### Workflow
