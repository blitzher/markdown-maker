const util = require("./tester.test.js");

describe("Basic features", () => {
    it("should raise an error if invalid token", () => {
        util.assert.throws(
            () => {
                const output = new util.Parser("#mdNON<>").get();
            },
            SyntaxError
        )
    });
    it("should join the files with include", () => {
        util.put("hello\n#mdinclude<sample2.md>", "sample1.md");
        util.put("there", "sample2.md");

        const parser = new util.Parser("test/test.files/sample1.md");
        const output = parser.get();

        util.assert.strictEqual(output, "hello\nthere\n\n");
    });
    it("should make a table of contents", () => {
        const output = new util.Parser("# yo\n## bruh\n#mdmaketoc<>").get();
        
        util.assert.strictEqual(output, "# yo\n## bruh\n* [yo](#yo)\n  * [bruh](#bruh)\n\n");
    });
});
