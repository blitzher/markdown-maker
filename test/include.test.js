const util = require("./tester.test");

describe("Managing blank lines", () => {
    it("should always end with 2 blank lines, even with no input", () => {
        util.put("", "sample1.md");

        const output = new util.Parser("test/test.files/sample1.md").get();
        util.assert.strictEqual(output, "\n\n")
    });

    it("should reduce blank lines to 2", () => {
        util.put("\n\n\n", "sample1.md");

        const output = new util.Parser("test/test.files/sample1.md").get();
        util.assert.strictEqual(output, "\n\n");
    });

    it("should allow words when removing blank lines", () => {
        util.put("hii\n\n\n", "sample1.md");

        const output = new util.Parser("test/test.files/sample1.md").get();
        util.assert.strictEqual(output, "hii\n\n")
    });
});


