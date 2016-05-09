End-to-end Test
===========
> You are not limited to choose your own way to implement end-to-end test

We adopt [Selenium webdriver](http://seleniumhq.github.io/selenium/docs/api/javascript/) as the browser automation test engine and Jasmine 2 as test framework.

### Setup
Selenium webdriver by default uses Firefox as test target browser.

If you'd like to run test in Chrome.
Download Chrome driver and put it a folder, add following line to your config.yaml or config.local.yaml
```yaml
e2etest:
    selenium:
        chromeDriver: '../chromedriver'
```
`../chromedriver` is the location you put your downloaded Chrome driver.


### Run test
```
gulp e2e
```

### Write test specs
TBD.

### Page object
TBD.
