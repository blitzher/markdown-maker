const util = require("./tester.test.js");
const fs = require("fs");

/* 
describe("Managing blank lines", () => {
    it("should always end with 2 blank lines, even with no input", () => {
        const output = new util.Parser("").get();
        util.assert.strictEqual(output, "\n\n")
    });

*/
describe("Use of templates", () => {
    it("should import templates as expected", () => {
        const output = new util.Parser("#mdpresentation").get();
        const template = fs
            .readFileSync("./src/templates/presentation.html")
            .toString();

        util.assert.strictEqual(output, template + "\n");
    });
});
