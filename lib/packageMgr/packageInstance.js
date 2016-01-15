var _ = require('lodash');

module.exports = Package;

/**
 * Package instance constructor
 * @param {string} attrs.name package name
 * @param {string} attrs.path absolute path of package folder
 * @param {function} attrs.exports the module.exports object returned from executed package main module
 */
function Package(attrs) {
	_.extend(this, attrs);
}
