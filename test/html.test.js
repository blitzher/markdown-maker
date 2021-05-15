const util = require("./tester.test.js");

describe("HTML Emitting", () => {
    it("should generate valid html", () => {
        const parser = new util.Parser("# cool title\nwith a cool paragraph");
        parser.opts.html = true;

        const output = parser.html();

        util.assert.strictEqual(output, '<h1 id="cool-title">cool title</h1>\n<p>with a cool paragraph</p>\n');
    });
    it("should emit an html file", () => {
        const parser = new util.Parser("# sum title\nand a paragraph");
        parser.opts.html = true;
        parser.opts.quiet = true;

        parser.to("test/test-files/dist/bundle.md");
        util.assert.strictEqual(util.fs.existsSync("test/test-files/dist/bundle.html"), true);

    });
    it("should be able to include html documents, and not parse")
})