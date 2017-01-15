var request = require('request');
var _ = require('lodash');

exports.activate = function() {
	const api = require('__api');
	const log = require('log4js').getLogger(api.packageName);
	var recipeNameRegs = [/.*?-recipe/, /([^\/]*\/)?recipe-.*?/];

	var verdaccioUrl = api.config.get(api.packageShortName + '.verdaccioUrl', 'http://localhost:4873');
	verdaccioUrl = _.trimEnd(verdaccioUrl, '/');
	api.router().use('/', api.cors());
	api.router().get('/packageBanner', (req, res) => {
		request({
			url: verdaccioUrl + '/-wfh/packages',
			method: 'GET',
			json: true
		}, (err, msg, body) => {
			if (err) {
				log.error('"/packageBanner" failed' , err);
				res.send({
					error: err,
					packages: []
				});
			} else {
				res.send(doAllPackages(body));
			}
		});
	});

	function doAllPackages(body) {
		var packages = [];
		var recipes = [];
		_.each(body.packages, json => {
			if (_.some(recipeNameRegs, reg => reg.test(json.name))) {
				log.debug('recipe: %s', json.name);
				recipes.push(json);
			} else
				packages.push(json);
		});
		return {
			packages: packages,
			recipes: recipes
		};
	}

	api.router().get('/searchPackage/:anything', (req, res) => {
		log.debug('search package %s', req.params.anything);
		request({
			url: verdaccioUrl + '/-/search/' + req.params.anything,
			method: 'GET',
			json: true
		}, (err, httpResponse, body) => {
			if (err) {
				log.error('/search/:anything failed' , err);
				res.send({
					error: err,
					packages: []
				});
				return;
			}
			log.debug(body.length);
			res.send({
				packages: body
			});
		});
	});

	api.router().get('/details/:package/:version', (req, res) => {
		request({
			url: verdaccioUrl + '/-/readme/' + encodeURIComponent(req.params.package),
			method: 'GET',
			json: true
		}, (err, httpResponse, body) => {
			if (err || body.error) {
				log.error('/-/readme/:package failed' , err);
				res.send({
					error: err || body.error,
					readme: ''
				});
				return;
			}
			//log.debug(body);
			res.send({
				readme: body
			});
		});
	});
};

