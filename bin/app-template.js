if (process.cwd() !== __dirname) {
	process.env.DR_ROOT_DIR = __dirname;
}
require('web-fun-house');
