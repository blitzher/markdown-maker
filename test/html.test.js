const util = require("./tester.test.js");

describe("HTML Emitting", () => {
    it("should emit an html file", (done) => {
        const parser = new util.Parser("# sum title\nand a paragraph");
        parser.opts.html = true;
        parser.opts.quiet = true;

        parser.to("test/test-files/dist/bundle.md", () => {
            util.assert.strictEqual(util.fs.existsSync("test/test-files/dist/bundle.html"), true);
            done();
        });
    });
    it("should generate valid html", () => {
        const parser = new util.Parser("# cool title\nwith a cool paragraph");
        parser.opts.html = true;

        const output = parser.html();

        util.assert.strictEqual(output, '<h1 id="cool-title">cool title</h1>\n<p>with a cool paragraph</p>\n');
    });
    it("should be able to include html documents, and not parse", () => {
        util.put("#mdinclude<sample2.html>", "sample1.md");
        util.put("#mdvar<lul>", "sample2.html");

        const parser = new util.Parser("test/test-files/sample1.md");
        const output = parser.get();

        util.assert.strictEqual(output, "#mdvar<lul>\n\n");
    });
})