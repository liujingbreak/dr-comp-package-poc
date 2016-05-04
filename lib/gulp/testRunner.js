var Path = require('path');
var Jasmine = require('jasmine');
var packageUtils = require('../packageMgr/packageUtils');
var fileExists = require('./packageInstallMgr').fileExists;
var log = require('log4js').getLogger(Path.basename(__filename, '.js'));
var chalk = require('chalk');
var config = require('../config');

exports.runUnitTest = runUnitTest;
exports.runE2eTest = runE2eTest;

function defaultConfig() {
	return {
		spec_dir: Path.relative(process.cwd(), config().rootPath),
		spec_files: [],
		helpers: [],
		stopSpecOnExpectationFailure: false,
		random: false
	};
}

function runUnitTest(argv) {
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

function runE2eTest(argv) {
	if (argv.f) {
		runJasmine(defaultConfig(), [].concat(argv.f), argv.spec);
		return;
	}
	var jasmineSetting = defaultConfig();

	if (!argv.d) {
		jasmineSetting.spec_files.push('e2etest/spec/**/*[sS]pec.js');
		jasmineSetting.helpers.push('e2etest/spec/helpers/**/*.js');
	} else {
		jasmineSetting.spec_files.push('e2etest/spec/' + argv.d + '/**/*[sS]pec.js');
		jasmineSetting.helpers.push('e2etest/spec/' + argv.d + '/helpers/**/*.js');
	}
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
