var request = require('request');
var _ = require('lodash');

exports.activate = function() {
	const api = require('__api');
	const log = require('log4js').getLogger(api.packageName);

	var verdaccioUrl = api.config.get(api.packageShortName + '.verdaccioUrl', 'http://localhost:4873');
	verdaccioUrl = _.trimEnd(verdaccioUrl, '/');

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
				res.send(body);
			}
		});
	});

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
			}
			log.debug(body.length);
			res.send({
				packages: body
			});
		});
	});
};

