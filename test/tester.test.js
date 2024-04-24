const fs = require("fs");
const assert = require("assert");
const Parser = require("../build/parse");
const path = require("path");

/* make folder for temporary files, if it doesn't exist */
if (
    !fs.existsSync("test/test-files") ||
    !fs.lstatSync("test/test-files").isDirectory()
) {
    fs.mkdirSync("test/test-files");
}

/**
 * Create a new file under `test/test-files` with the given content.
 * @param {string} text
 * @param {string} file
 */
function put(text, file) {
    fs.writeFileSync(path.join("test", "test-files", file), text);
}
function putDir(name) {
    fs.mkdirSync(path.join("test", "test-files", name));
}

const TargetType = {
    HTML: 0,
    MARKDOWN: 1,
};

module.exports = {
    fs,
    assert,
    path,
    Parser,
    put,
    putDir,
    TargetType,
};
