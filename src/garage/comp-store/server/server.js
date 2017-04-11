var api = require('__api');
var request = require('request');
var _ = require('lodash');
var path = require('path');
var low = require('lowdb');
var mkdirp = require('mkdirp');
//初始化头像数据库
var workspace = api.config.get('rootPath');
var avatarDBPath = path.join(workspace, './staticDB/avatars/');
mkdirp.sync(avatarDBPath);
var db = low(path.join(workspace, './staticDB/avatars/avatar.json'));
if (!db.has('avatars').value()) {
	db.defaults({
		avatars: []
	}).write();
}

exports.activate = function() {
	const api = require('__api');
	const log = require('log4js').getLogger(api.packageName);
	var recipeNameRegs = [/.*?-recipe/, /([^\/]*\/)?recipe-.*?/];

	var verdaccioUrl = api.config.get(api.packageShortName + '.verdaccioUrl', 'http://localhost:4873');
	verdaccioUrl = _.trimEnd(verdaccioUrl, '/');
	api.router().use('/', api.cors());
	api.router().get('/packageBanner', (req, res) => {
		var page = req.query.page;
		var pageSize = req.query.pageSize;
		request({
			url: verdaccioUrl + '/-wfh/packages?page=' + page + '&pageSize=' + pageSize,
			method: 'GET',
			json: true
		}, (err, msg, body) => {
			if (err) {
				log.error('"/-wfh/packageBanner" failed', err);
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
			packages: packages || [],
			recipes: recipes,
			page: body.page || 0,
			pageSize: body.pageSize || 0,
			totalPage: body.totalPage || 0
		};
	}

	api.router().get('/searchPackage/:anything', (req, res) => {
		log.debug('search package %s', req.params.anything);
		var page = req.query.page;
		var pageSize = req.query.pageSize;
		request({
			url: verdaccioUrl + '/-wfh/search/' + req.params.anything + '?page=' + page + '&pageSize=' + pageSize,
			method: 'GET',
			json: true
		}, (err, httpResponse, body) => {
			if (err) {
				log.error('/search/:anything failed', err);
				res.send({
					error: err,
					packages: []
				});
				return;
			}
			log.debug(body.length);
			res.send({
				packages: body.packages || [],
				page: body.page || 0,
				pageSize: body.pageSize || 0,
				totalPage: body.totalPage || 0
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
				log.error('/-/readme/:package failed', err);
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

	api.router().get('/select/:by/:value', (req, res) => {
		var page = req.query.page;
		var pageSize = req.query.pageSize;
		var by = req.params.by;
		var value = req.params.value;
		request({
			url: verdaccioUrl + '/-wfh/select/' + by + '/' + value + '?page=' + page + '&pageSize=' + pageSize,
			method: 'GET',
			json: true
		}, (err, msg, body) => {
			if (err) {
				log.error('"/-wfh/select" failed', err);
				res.send({
					error: err,
					packages: []
				});
			} else {
				res.send(doAllPackages(body));
			}
		});
	});

	api.router().get('/avatar/list', (req, res) => {
		try {
			var data = db.get('avatars').value();
			res.send(data);
		} catch (e) {
			res.send('error');
		}
	});

	api.router().post('/avatar/add', (req, res) => {
		try {
			var id = req.body.id || req.query.id;
			var url = req.body.url || req.query.url;
			var userId = guid();
			var new_obj = {
				userId: userId,
				id: id.toString(),
				url: url.toString()
			};
			db.get('avatars').push(new_obj).write();
			res.send('success');
		} catch (e) {
			console.info(e)
			res.send('error');
		}
	});

	api.router().post('/avatar/edit', (req, res) => {
		try {
			var id = req.body.id || req.query.id;
			var url = req.body.url || req.query.url;
			var userId = req.body.userId || req.query.userId;
			db.get('avatars')
				.find({
					userId: userId
				})
				.assign({
					userId: userId,
					id: id,
					url: url
				})
				.write();
			res.send('success');
		} catch (e) {
			res.send('error');
		}
	});

	api.router().post('/avatar/delete', (req, res) => {
		try {
			var userId = req.body.userId || req.query.userId;
			db.get('avatars')
				.remove({
					userId: userId
				})
				.write();
			res.send('success');
		} catch (e) {
			res.send('error');
		}
	});

	api.router().post('/avatar/selectByName', (req, res) => {
		try {
			var name = req.body.name || req.query.name;
			var data = db.get('avatars')
				.find({
					id: name
				}).value();
			res.send(data);
		} catch (e) {
			console.info(e)
			res.send('error');
		}
	});
};

function guid() {
	function S4() {
		return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
	}
	return (S4() + S4() + '-' + S4() + '-' + S4() + '-' + S4() + '-' + S4() + S4() + S4());
}

exports.onCompileTemplate = function(relativeHtmlFilePath, swig) {
	const api = require('__api');
	if (relativeHtmlFilePath === 'views/componentStore.html') {
		return {
			locals: {
				npmHost: api.config.get([api.packageName, 'npmHost'], 'npm.dianrong.com')
			}
		};
	}
	return null;
};
