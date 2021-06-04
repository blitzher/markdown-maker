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
    it("should join two files with include", () => {
        util.put("hello\n#mdinclude<sample2.md>", "sample1.md");
        util.put("there", "sample2.md");

        const parser = new util.Parser("test/test-files/sample1.md");
        const output = parser.get();

        util.assert.strictEqual(output, "hello\nthere\n\n");
    });
    it("should make a table of contents", () => {
        const output = new util.Parser("# yo\n## bruh nugget\n#mdmaketoc").get();

        util.assert.strictEqual(output, "# yo\n## bruh nugget\n* [yo](#yo)\n  * [bruh nugget](#bruh-nugget)\n\n");
    });
    it("should allow quotation marks in titles for toc", () => {
        const parser = new util.Parser("# mac's farm\n#mdmaketoc")
        const markdown = parser.get();

        util.assert.strictEqual(markdown, "# mac's farm\n* [mac's farm](#macs-farm)\n\n")
    });
    it("should allow variables in toc", () => {
        const parser = new util.Parser("#mddef<name=Foobar>\n# mr. #mdvar<name>\n#mdmaketoc<>");

        util.assert.strictEqual(parser.get(), "\n# mr. Foobar\n* [mr. Foobar](#mr-foobar)\n\n");
    });
    it("should not exceed max include depth", () => {
        util.put("#mdinclude<sample2.md>", "sample1.md");
        util.put("yo.md>", "sample2.md");

        util.assert.throws(
            () => {
                const parser = new util.Parser("test/test-files/sample1.md");
                parser.opts.max_depth = 0;
                parser.get();
            },
            Error
        )
    });
});
