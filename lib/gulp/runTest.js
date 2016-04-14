var Path = require('path');
var Jasmine = require('jasmine');
var packageUtils = require('../packageMgr/packageUtils');
var fileExists = require('./packageInstallMgr').fileExists;
var log = require('log4js').getLogger('runTest');
var chalk = require('chalk');

module.exports = runTest;

function defaultConfig() {
	return {
		spec_dir: '',
		spec_files: [],
		helpers: [],
		stopSpecOnExpectationFailure: false,
		random: false
	};
}

function runTest(argv) {
	if (argv.f) {
		runJasmine(defaultConfig(), [].concat(argv.f), argv.spec);
		return;
	}
	var jasmineSetting = defaultConfig();

	if (!argv.p) {
		jasmineSetting.spec_files.push('spec/**/*[sS]pec.js');
		jasmineSetting.helpers.push('spec/helpers/**/*.js');
	}
	var packages = argv.p ? [].concat(argv.p) : null;
	packageUtils.findAllPackages(packages, (name, entryPath, parsedName, json, packagePath) => {
		if (!fileExists(Path.join(packagePath, 'spec'))) {
			return;
		}
		log.info('Found test for package: ' + name);
		var relativePkPath = Path.relative(Path.resolve(), packagePath);
		jasmineSetting.spec_files.push(relativePkPath.replace(/\\/g, '/') + '/spec/**/*[sS]pec.js');
		jasmineSetting.helpers.push(relativePkPath.replace(/\\/g, '/') + '/spec/helpers/**/*[sS]pec.js');
	}, 'src');
	log.debug(jasmineSetting.spec_files);
	runJasmine(jasmineSetting);
}

function runJasmine(jasmineSetting, files, spec) {
	var jasmine = new Jasmine();
	jasmine.configureDefaultReporter({});
	jasmine.addReporter(simpleReporter);
	if (files) {
		jasmine.execute(files, spec);
	} else {
		jasmine.loadConfig(jasmineSetting);
		jasmine.execute();
	}
}

var simpleReporter = {
	jasmineStarted: function(suiteInfo) {
		log.info(chalk.cyan('Total specs defined: ' + suiteInfo.totalSpecsDefined));
	},
	specStarted: function(result) {
		log.info(chalk.cyan.underline(result.fullName));
	}
};
