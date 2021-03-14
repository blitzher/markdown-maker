const fs = require("fs");
const assert = require("assert");
const Parser = require("../src/parse");

function put(text, file) {
    fs.writeFileSync("test/test.files/" + file, text );
}

module.exports = {
    fs,
    assert,
    Parser,
    put,
}