const util = require("./tester.test.js");

describe("Command Line Arguments", () => {
    it("--use-underscore should replace '-' with '_' in toc", () => {
        const output = new util.Parser("# foo bar\n#mdmaketoc", {
            use_underscore: true,
        }).get();

        util.assert.strictEqual(output, "# foo bar\n* [foo bar](#foo_bar)\n\n");
    });
    it("--toc-level should exclude subsection with lower level", () => {
        const output = new util.Parser("# foo bar\n### baz\n#mdmaketoc", {
            toc_level: 2,
        }).get();

        util.assert.strictEqual(
            output,
            "# foo bar\n### baz\n* [foo bar](#foo-bar)\n\n"
        );
    });
    it("--allow-undef should not throw when variable is not defined", () => {
        const output = new util.Parser("#mdvar<zum>", {
            allow_undef: true,
        }).get();

        util.assert.strictEqual(output, "<zum>\n\n");
    });
    describe("Conditional imports", () => {
        it("should be able to conditionally import documents", () => {
            util.put("hello\n#mdinclude<sample2.md,YES>", "sample1.md");
            util.put("there", "sample2.md");

            const parser1 = new util.Parser("test/test-files/sample1.md");
            parser1.opts.defs.YES = true;
            const output1 = parser1.get();

            util.assert.strictEqual(output1, "hello\nthere\n\n");
        });
        it("shouldn't include a document when flag is unset", () => {
            util.put("hello\n#mdinclude<sample2.md,YES>", "sample1.md");
            util.put("there", "sample2.md");

            const parser2 = new util.Parser("test/test-files/sample1.md");

            const output2 = parser2.get();

            util.assert.strictEqual(output2, "hello\n\n");
        });
    });
});
