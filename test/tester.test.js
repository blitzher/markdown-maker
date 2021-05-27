const fs = require("fs");
const assert = require("assert");
const Parser = require("../src/parse");

/* make folder for temporary files, if it doesn't exist */
if (!fs.existsSync("test/test-files") || !fs.lstatSync("test/test-files").isDirectory()) {
    fs.mkdirSync("test/test-files")
}

function put(text, file) {
    fs.writeFileSync("test/test-files/" + file, text);
}

const TargetType = {
    HTML: 0,
    MARKDOWN: 1
}


module.exports = {
    fs,
    assert,
    Parser,
    put,
    TargetType
}