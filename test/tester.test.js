const fs = require('fs');
const assert = require('assert');
const Parser = require('../build/parse');

/* make folder for temporary files, if it doesn't exist */
if (
	!fs.existsSync('test/test-files') ||
	!fs.lstatSync('test/test-files').isDirectory()
) {
	fs.mkdirSync('test/test-files');
}

function put(text, file) {
	fs.writeFileSync('test/test-files/' + file, text);
}

module.exports = {
	fs,
	assert,
	Parser,
	put,
};
